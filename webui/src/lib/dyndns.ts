import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import {
  BACKUP_DIR,
  CONFIG_PATH,
  readConfig,
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

function outcomeForDomain(domain: string, stdout: string): UpdateOutcome {
  const marker = `Read ${domain} config.`;
  const idx = stdout.indexOf(marker);
  const block =
    idx === -1 ? stdout : stdout.slice(idx + marker.length, stdout.length);
  if (block.includes("DNS records successfully updated.")) return "ok";
  if (block.includes("All records up to date")) return "unchanged";
  if (block.includes("Could not update DNS records.")) return "error";
  if (block.includes("not configured") || block.includes("configured incorrectly")) {
    return "error";
  }
  return "unknown";
}

export async function runUpdateAll(): Promise<UpdateSummary> {
  const { stdout } = await runCli(["update", "--all"]);
  let config: DomainConfig = {};
  try {
    config = readConfig();
  } catch {
    config = {};
  }
  const domains: Record<string, UpdateOutcome> = {};
  for (const domain of Object.keys(config)) {
    domains[domain] = outcomeForDomain(domain, stdout);
  }
  return { domains, raw: stdout };
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
