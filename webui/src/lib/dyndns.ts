import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import {
  BACKUP_DIR,
  CONFIG_PATH,
  readConfig,
  writeConfig,
  type DomainConfig,
} from "@/lib/config-store";

const CLI = process.env.DYNDNS_CLI ?? "domain-connect-dyndns";

export interface CliResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

function runCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(CLI, ["--config", CONFIG_PATH, ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    child.stderr.on("data", (d: Buffer) => (stderr += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

/**
 * Best-effort human message from CLI output. Skips the version banner and
 * Python traceback frames (errors often land on stderr).
 */
export const lastMeaningfulLine = (stdout: string, stderr: string): string => {
  const meaningful = (lines: string[]) =>
    lines
      .map((l) => l.trim())
      .filter(
        (l) => l && !l.startsWith("***") && !l.startsWith("Traceback")
      );
  const fromErr = meaningful(stderr.split("\n")).filter(
    (l) => !l.startsWith("File ") && !l.startsWith("^")
  );
  if (fromErr.length > 0) {
    return fromErr[fromErr.length - 1];
  }
  const fromOut = meaningful(stdout.split("\n"));
  if (fromOut.length > 0) {
    return fromOut[fromOut.length - 1];
  }
  return "";
};

/**
 * Update outcomes are detected from the CLI's own stdout text
 * (verified against domain-connect-dyndns 0.0.9 source).
 */
export type UpdateOutcome = "ok" | "error" | "unchanged" | "unknown";

export interface UpdateSummary {
  domains: Record<string, UpdateOutcome>;
  raw: string;
}

/** Shown when a failed attempt produced no usable error text (FR-007). */
export const FALLBACK_REASON =
  "Update failed. No error details reported by the updater.";

const REASON_MAX_LENGTH = 500;

/** CLI status lines that describe the outcome, not the failure cause. */
const STATUS_MARKERS = [
  "DNS records successfully updated.",
  "All records up to date",
  "Could not update DNS records.",
  "not configured",
  "configured incorrectly",
];

/**
 * Best-effort failure reason for one domain, extracted from the CLI's
 * per-domain output block. Returns `null` when nothing usable remains.
 */
export function failureReasonForDomain(
  domain: string,
  stdout: string,
  stderr: string
): string | null {
  const marker = `Read ${domain} config.`;
  const idx = stdout.indexOf(marker);
  const next = stdout.indexOf("\nRead ", idx + marker.length);
  const block = stdout.slice(
    idx === -1 ? 0 : idx + marker.length,
    next === -1 ? undefined : next
  );
  const meaningful = (lines: string[]) =>
    lines
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !l.startsWith("***") &&
          !l.startsWith("Traceback") &&
          !l.startsWith("File ") &&
          !l.startsWith("^") &&
          !STATUS_MARKERS.some((m) => l.includes(m))
      );
  const lines = [
    ...meaningful(block.split("\n")),
    ...meaningful(stderr.split("\n")),
  ];
  const last = lines[lines.length - 1];
  if (!last) {
    return null;
  }
  return last.slice(0, REASON_MAX_LENGTH);
}

/**
 * Replaces the domain's stored token values with a placeholder so
 * credentials never end up in a persisted or displayed reason (FR-008).
 */
export function redactSecrets(reason: string, domain: string): string {
  let config: DomainConfig = {};
  try {
    config = readConfig();
  } catch {
    return reason;
  }
  const entry = config[domain];
  let out = reason;
  for (const field of ["access_token", "refresh_token"] as const) {
    const value = entry?.[field];
    if (value) {
      out = out.split(value).join("[redacted]");
    }
  }
  return out;
}

function outcomeForDomain(domain: string, stdout: string): UpdateOutcome {
  const marker = `Read ${domain} config.`;
  const idx = stdout.indexOf(marker);
  const next = stdout.indexOf("\nRead ", idx + marker.length);
  const block = stdout.slice(
    idx === -1 ? 0 : idx + marker.length,
    next === -1 ? undefined : next
  );
  if (block.includes("DNS records successfully updated.")) return "ok";
  if (block.includes("All records up to date")) return "unchanged";
  if (block.includes("Could not update DNS records.")) return "error";
  if (block.includes("not configured") || block.includes("configured incorrectly")) {
    return "error";
  }
  return "unknown";
}

/**
 * Applies one domain's outcome to the config entry: sets `last_error`
 * for failed attempts, clears it on success. Returns whether the config
 * changed (i.e. must be written).
 */
function persistOutcome(
  config: DomainConfig,
  domain: string,
  outcome: UpdateOutcome,
  stdout: string,
  stderr: string
): boolean {
  const entry = config[domain];
  if (!entry) {
    return false;
  }
  if (outcome === "error") {
    const reason = redactSecrets(
      failureReasonForDomain(domain, stdout, stderr) ?? FALLBACK_REASON,
      domain
    );
    if (entry.last_error !== reason) {
      entry.last_error = reason;
      return true;
    }
  } else if (
    (outcome === "ok" || outcome === "unchanged") &&
    entry.last_error !== undefined
  ) {
    delete entry.last_error;
    return true;
  }
  return false;
}

export async function runUpdateAll(): Promise<UpdateSummary> {
  const { stdout, stderr } = await runCli(["update", "--all"]);
  let config: DomainConfig = {};
  try {
    config = readConfig();
  } catch {
    config = {};
  }
  const domains: Record<string, UpdateOutcome> = {};
  let changed = false;
  for (const domain of Object.keys(config)) {
    const outcome = outcomeForDomain(domain, stdout);
    domains[domain] = outcome;
    changed = persistOutcome(config, domain, outcome, stdout, stderr) || changed;
  }
  if (changed) {
    writeConfig(config);
  }
  return { domains, raw: stdout };
}

/** Runs the updater for a single domain and persists its outcome. */
export async function runUpdateOne(domain: string): Promise<UpdateSummary> {
  const { stdout, stderr } = await runCli(["update", "--domain", domain]);
  let config: DomainConfig = {};
  try {
    config = readConfig();
  } catch {
    config = {};
  }
  const outcome = outcomeForDomain(domain, stdout);
  if (persistOutcome(config, domain, outcome, stdout, stderr)) {
    writeConfig(config);
  }
  return { domains: { [domain]: outcome }, raw: stdout };
}

export async function removeDomain(domain: string): Promise<CliResult> {
  mkdirSync(BACKUP_DIR, { recursive: true });
  const backupFile = `${BACKUP_DIR}/${Date.now()}-${domain}.bak`;
  return runCli([
    "remove",
    "--domain",
    domain,
    "--backup_file",
    backupFile,
  ]);
}

/** Live handle on a `setup` subprocess for a new domain. */
export interface SetupChild {
  proc: ChildProcess;
  /** Resolves with the consent URL once printed by the CLI. */
  url: Promise<string>;
  /** Resolves when the CLI process exits. */
  done: Promise<CliResult>;
}

export function startSetup(domain: string): SetupChild {
  const proc = spawn(CLI, ["--config", CONFIG_PATH, "setup", "--domain", domain]);
  let stdout = "";
  let stderr = "";
  proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
  proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

  const url = new Promise<string>((resolve, reject) => {
    const scan = setInterval(() => {
      const match = stdout.match(/https:\/\/\S+/);
      if (match) {
        clearInterval(scan);
        resolve(match[0]);
      }
    }, 100);
    proc.on("close", () => {
      clearInterval(scan);
      reject(new Error("Setup process exited before an authorization URL appeared"));
    });
  });

  const done = new Promise<CliResult>((resolve) => {
    proc.on("close", (code) =>
      resolve({ stdout, stderr, code: code === null ? null : code })
    );
  });

  return { proc, url, done };
}

export function submitSetupCode(proc: ChildProcess, code: string): void {
  if (!proc.stdin) {
    return;
  }
  proc.stdin.write(`${code}\n`);
}

export function cancelSetup(proc: ChildProcess): void {
  try {
    proc.kill();
  } catch {
    // already gone
  }
}
