import { readFileSync, writeFileSync } from "node:fs";
import { appError } from "@/lib/errors";

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
