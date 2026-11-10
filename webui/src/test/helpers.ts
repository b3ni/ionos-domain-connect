import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { vi } from "vitest";

/** A throwaway directory with a config.json path and a backups dir. */
export function tempWorkspace(config?: unknown) {
  const dir = mkdtempSync(join(tmpdir(), "idc-test-"));
  const configPath = join(dir, "config.json");
  if (config !== undefined) {
    writeFileSync(
      configPath,
      typeof config === "string" ? config : JSON.stringify(config, null, 1)
    );
  }
  return { dir, configPath, backupDir: join(dir, "backups") };
}

/** Writes an executable shell script and returns its path. */
export function writeScript(dir: string, name: string, body: string): string {
  const path = join(dir, name);
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return path;
}

/**
 * Modules read their env (CONFIG_PATH, DYNDNS_CLI, CLI_TIMEOUT …) at load
 * time: stub the env, drop the module cache and import a fresh copy.
 */
export async function importWithEnv<T>(
  specifier: string,
  env: Record<string, string>
): Promise<T> {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value);
  }
  return (await import(/* @vite-ignore */ specifier)) as T;
}
