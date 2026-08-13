import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { appError } from "@/lib/errors";

export interface ConfigFileState {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: DomainConfig | null;
  parseError: string | null;
}

export const CONFIG_PATH = process.env.CONFIG_PATH ?? "/config.json";

/**
 * Raw config.json shape as written by the domain-connect-dyndns CLI:
 * a flat object keyed by domain name (verified against CLI source 0.0.9).
 */
export interface DomainConfigEntry {
  provider_name?: string;
  url_api?: string;
  access_token?: string;
  refresh_token?: string;
  iat?: number;
  access_token_expires_in?: number;
  protocols?: string[];
  last_dns_check?: number;
  last_success?: number;
  last_attempt?: number;
  last_error?: string;
  ip?: Record<string, string>;
}

export type DomainConfig = Record<string, DomainConfigEntry>;

export function readConfig(): DomainConfig {
  let raw: string;
  try {
    raw = readFileSync(CONFIG_PATH, "utf8");
  } catch {
    throw appError(
      "INTERNAL",
      `Could not read config file ${CONFIG_PATH}`
    );
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("config is not an object");
    }
    return parsed as DomainConfig;
  } catch {
    throw appError("INTERNAL", `Config file ${CONFIG_PATH} is not valid JSON`);
  }
}

export function configExists(): boolean {
  try {
    readFileSync(CONFIG_PATH, "utf8");
    return true;
  } catch {
    return false;
  }
}

/** Reads the file as text without parsing; distinguishes missing vs. unreadable. */
export function readConfigRaw(): { exists: boolean; raw: string | null } {
  try {
    return { exists: true, raw: readFileSync(CONFIG_PATH, "utf8") };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { exists: false, raw: null };
    }
    throw appError(
      "INTERNAL",
      `Could not read config file ${CONFIG_PATH}`
    );
  }
}

/** Parses raw text; returns a human-readable error instead of throwing. */
export function parseConfig(
  raw: string
): { parsed: unknown; error: string | null } {
  try {
    return { parsed: JSON.parse(raw), error: null };
  } catch {
    return {
      parsed: null,
      error: "The file is empty or does not contain valid JSON.",
    };
  }
}

/** The expected shape: a flat object keyed by non-empty domain names. */
export function validateConfigShape(parsed: unknown): parsed is DomainConfig {
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return false;
  }
  return Object.keys(parsed).every((key) => key.trim().length > 0);
}

/** Full view state for the config editor (contracts/api.md GET /api/config). */
export function readConfigState(): ConfigFileState {
  const { exists, raw } = readConfigRaw();
  if (!exists) {
    return { path: CONFIG_PATH, exists: false, raw: null, parsed: null, parseError: null };
  }
  const { parsed, error } = parseConfig(raw as string);
  if (error || !validateConfigShape(parsed)) {
    return {
      path: CONFIG_PATH,
      exists: true,
      raw,
      parsed: null,
      parseError:
        error ?? "The file contains valid JSON but is not an object keyed by domain name.",
    };
  }
  return { path: CONFIG_PATH, exists: true, raw, parsed, parseError: null };
}

/**
 * Persists the whole config object, preserving every key and using the
 * CLI-compatible `indent=1` formatting so the domain-connect-dyndns CLI
 * round-trips our fields unchanged (verified against CLI source 0.0.9).
 */
export function writeConfig(config: DomainConfig): void {
  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 1));
  } catch {
    throw appError(
      "INTERNAL",
      `Could not write config file ${CONFIG_PATH}`
    );
  }
}

/** Guarantees a writable backups dir for `remove --backup_file`. */
export const BACKUP_DIR = process.env.BACKUP_DIR ?? "/backups";

/**
 * Validates, backs up and atomically replaces the config file
 * (contracts/api.md PUT /api/config). Throws AppError:
 * VALIDATION (bad JSON / wrong shape), NOT_FOUND (missing file),
 * CONFLICT (disk changed since load), INTERNAL (I/O failure).
 */
export function saveConfig(
  raw: string,
  baseRaw: string | null
): { backupPath: string | null } {
  const { parsed, error } = parseConfig(raw);
  if (error || !validateConfigShape(parsed)) {
    throw appError(
      "VALIDATION",
      error ??
        "The file must contain a JSON object keyed by domain names."
    );
  }

  let current: string;
  try {
    current = readFileSync(CONFIG_PATH, "utf8");
  } catch {
    throw appError("NOT_FOUND", `Config file ${CONFIG_PATH} does not exist.`);
  }

  if (baseRaw !== null && baseRaw !== current) {
    throw appError(
      "CONFLICT",
      "The config file changed on disk since it was loaded. Reload and re-apply your edits."
    );
  }

  let backupPath: string | null = null;
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    backupPath = join(BACKUP_DIR, `config.${Date.now()}.json`);
    copyFileSync(CONFIG_PATH, backupPath);
  } catch {
    throw appError(
      "INTERNAL",
      `Could not back up the config file to ${BACKUP_DIR}`
    );
  }

  // Atomic replace: write to a temp file, then rename over the target so
  // the scheduler never reads a half-written file.
  const tmpPath = `${CONFIG_PATH}.tmp`;
  try {
    writeFileSync(tmpPath, JSON.stringify(parsed, null, 1));
    renameSync(tmpPath, CONFIG_PATH);
  } catch (writeError) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // best-effort cleanup; report the original error below
    }
    throw appError(
      "INTERNAL",
      `Could not write config file ${CONFIG_PATH}`,
      writeError
    );
  }

  return { backupPath };
}
