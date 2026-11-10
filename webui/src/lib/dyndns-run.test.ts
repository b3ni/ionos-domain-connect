import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importWithEnv, tempWorkspace, writeScript } from "@/test/helpers";
import { BANNER, NOTFOUND_SESSION, failed, updated } from "@/test/cli-output";

type Dyndns = typeof import("@/lib/dyndns");

/** A fake CLI that prints the given stdout/stderr (and optionally hangs). */
async function setup(opts: { stdout: string; stderr?: string; hang?: boolean; timeoutSec?: string }) {
  const ws = tempWorkspace({
    "a.example.com": {
      provider_name: "IONOS",
      url_api: "https://api.example",
      access_token: "AT-secret-123",
      refresh_token: "RT-secret-456",
      last_error: "old error",
    },
  });
  writeFileSync(join(ws.dir, "stdout.txt"), opts.stdout);
  writeFileSync(join(ws.dir, "stderr.txt"), opts.stderr ?? "");
  const cli = writeScript(
    ws.dir,
    "fake-cli",
    `cat "${ws.dir}/stdout.txt"\ncat "${ws.dir}/stderr.txt" >&2\n${opts.hang ? "sleep 30" : ""}`
  );
  const dyndns = await importWithEnv<Dyndns>("@/lib/dyndns", {
    CONFIG_PATH: ws.configPath,
    BACKUP_DIR: ws.backupDir,
    DYNDNS_CLI: cli,
    CLI_TIMEOUT: opts.timeoutSec ?? "10",
  });
  const config = () => JSON.parse(readFileSync(ws.configPath, "utf8"));
  return { dyndns, config };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("runUpdateOne", () => {
  it("clears last_error after a successful update", async () => {
    const { dyndns, config } = await setup({ stdout: BANNER + updated("a.example.com") });
    const summary = await dyndns.runUpdateOne("a.example.com");
    expect(summary.domains).toEqual({ "a.example.com": "ok" });
    expect(config()["a.example.com"].last_error).toBeUndefined();
  });

  it("stores the failure reason with the domain's tokens redacted", async () => {
    const { dyndns, config } = await setup({
      stdout: BANNER + failed("a.example.com", `${NOTFOUND_SESSION} token=AT-secret-123`),
    });
    const summary = await dyndns.runUpdateOne("a.example.com");
    expect(summary.domains).toEqual({ "a.example.com": "error" });
    const entry = config()["a.example.com"];
    expect(entry.last_error).toBe(`${NOTFOUND_SESSION} token=[redacted]`);
    expect(entry.access_token).toBe("AT-secret-123");
  });

  it("kills a hung CLI after CLI_TIMEOUT and records the timeout", async () => {
    const { dyndns, config } = await setup({
      stdout: BANNER + "\nRead a.example.com config.\n",
      hang: true,
      timeoutSec: "1",
    });
    const started = Date.now();
    const summary = await dyndns.runUpdateOne("a.example.com");
    // `sleep` is a grandchild holding stdout open: only a process-group
    // kill lets the run finish this fast.
    expect(Date.now() - started).toBeLessThan(5000);
    expect(summary.domains).toEqual({ "a.example.com": "error" });
    expect(config()["a.example.com"].last_error).toBe(
      "The updater timed out after 1s and was stopped."
    );
  });
});
