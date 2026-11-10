import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { importWithEnv, tempWorkspace } from "@/test/helpers";

type Store = typeof import("@/lib/config-store");

const CONFIG = {
  "a.example.com": {
    provider_name: "IONOS",
    access_token: "AT-real-aaa",
    refresh_token: "RT-real-aaa",
  },
  "b.example.com": { provider_name: "IONOS", access_token: "AT-real-bbb" },
};

const MISSING = Symbol("no config file");

async function load(config: unknown = CONFIG) {
  const ws = tempWorkspace(config === MISSING ? undefined : config);
  const store = await importWithEnv<Store>("@/lib/config-store", {
    CONFIG_PATH: ws.configPath,
    BACKUP_DIR: ws.backupDir,
  });
  const disk = () => readFileSync(ws.configPath, "utf8");
  return { ws, store, disk };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("maskSecrets", () => {
  it("hides token values and keeps everything else byte for byte", async () => {
    const { store } = await load();
    const raw = '{\n "x": {"access_token": "AT-1", "refresh_token":"RT-1", "url_api": "u"}\n}';
    const masked = store.maskSecrets(raw);
    expect(masked).not.toContain("AT-1");
    expect(masked).not.toContain("RT-1");
    expect(masked).toMatch(/^\{\n "x": \{"access_token": "__SECRET_[0-9a-f]{16}__", "refresh_token":"__SECRET_[0-9a-f]{16}__", "url_api": "u"\}\n\}$/);
  });

  it("gives equal values equal placeholders and different values different ones", async () => {
    const { store } = await load();
    const a = store.maskSecrets('{"access_token": "same"}');
    const b = store.maskSecrets('{"refresh_token": "same"}');
    const c = store.maskSecrets('{"access_token": "other"}');
    const ph = (s: string) => s.match(/__SECRET_[0-9a-f]{16}__/)![0];
    expect(ph(a)).toBe(ph(b));
    expect(ph(a)).not.toBe(ph(c));
  });

  it("masks a corrupt file and values with escaped quotes", async () => {
    const { store } = await load();
    const masked = store.maskSecrets('{"d": {"access_token": "A\\"B-secret", "refresh_token": "RT-x",');
    expect(masked).not.toContain("secret");
    expect(masked).not.toContain("RT-x");
  });

  it("leaves empty tokens alone", async () => {
    const { store } = await load();
    expect(store.maskSecrets('{"access_token": ""}')).toBe('{"access_token": ""}');
  });
});

describe("readConfigState", () => {
  it("never returns token values", async () => {
    const { store } = await load();
    const state = store.readConfigState();
    expect(JSON.stringify(state)).not.toMatch(/AT-real|RT-real/);
    expect(state.parsed?.["a.example.com"].provider_name).toBe("IONOS");
    expect(state.parseError).toBeNull();
  });

  it("reports a missing file", async () => {
    const { store } = await load(MISSING);
    expect(store.readConfigState()).toMatchObject({ exists: false, raw: null });
  });

  it("reports invalid JSON and a wrong shape, still masked", async () => {
    let { store } = await load('{"a": {"access_token": "AT-broken"');
    let state = store.readConfigState();
    expect(state.parsed).toBeNull();
    expect(state.parseError).toMatch(/not contain valid JSON/);
    expect(state.raw).not.toContain("AT-broken");

    ({ store } = await load("[1, 2]"));
    state = store.readConfigState();
    expect(state.parseError).toMatch(/not an object keyed by domain/);
  });
});

describe("saveConfig", () => {
  it("restores tokens, applies the edit and backs up the previous file", async () => {
    const { ws, store, disk } = await load();
    const before = disk();
    const { raw } = store.readConfigState();
    const edited = raw!.replace('"provider_name": "IONOS"', '"provider_name": "EDITED"');

    const { backupPath } = store.saveConfig(edited, raw);

    const saved = JSON.parse(disk());
    expect(saved["a.example.com"]).toEqual({
      provider_name: "EDITED",
      access_token: "AT-real-aaa",
      refresh_token: "RT-real-aaa",
    });
    expect(saved["b.example.com"].access_token).toBe("AT-real-bbb");
    expect(readdirSync(ws.backupDir)).toHaveLength(1);
    expect(readFileSync(backupPath!, "utf8")).toBe(before);
  });

  it("keeps a domain's tokens when its key is renamed", async () => {
    const { store, disk } = await load();
    const { raw } = store.readConfigState();
    store.saveConfig(raw!.replace('"a.example.com"', '"renamed.example.com"'), raw);
    const saved = JSON.parse(disk());
    expect(saved["renamed.example.com"].refresh_token).toBe("RT-real-aaa");
    expect(saved["a.example.com"]).toBeUndefined();
  });

  it("rejects a placeholder that matches no stored token", async () => {
    const { store, disk } = await load();
    const before = disk();
    const { raw } = store.readConfigState();
    const forged = raw!.replace(/__SECRET_[0-9a-f]{16}__/, "__SECRET_0000000000000000__");
    expect(() => store.saveConfig(forged, raw)).toThrow(
      expect.objectContaining({ code: "VALIDATION" })
    );
    expect(disk()).toBe(before);
  });

  it("reports a conflict when the file changed after it was loaded", async () => {
    const { ws, store, disk } = await load();
    const { raw } = store.readConfigState();
    // e.g. an update rotated the refresh token meanwhile
    writeFileSync(ws.configPath, disk().replace("RT-real-aaa", "RT-rotated"));
    expect(() => store.saveConfig(raw!, raw)).toThrow(
      expect.objectContaining({ code: "CONFLICT" })
    );
    expect(disk()).toContain("RT-rotated");
  });

  it("rejects invalid JSON and the wrong shape without touching the file", async () => {
    const { store, disk } = await load();
    const before = disk();
    const { raw } = store.readConfigState();
    for (const bad of ["{not json", "[]", '{"": {}}']) {
      expect(() => store.saveConfig(bad, raw)).toThrow(
        expect.objectContaining({ code: "VALIDATION" })
      );
    }
    expect(disk()).toBe(before);
  });

  it("can repair a corrupt file, restoring its tokens", async () => {
    const { store, disk } = await load('{"a.example.com": {"access_token": "AT-keep", ');
    const { raw } = store.readConfigState();
    store.saveConfig(`${raw}"provider_name": "IONOS"}}`, raw);
    expect(JSON.parse(disk())["a.example.com"].access_token).toBe("AT-keep");
  });

  it("is NOT_FOUND when the file does not exist", async () => {
    const { store } = await load(MISSING);
    expect(() => store.saveConfig("{}", null)).toThrow(
      expect.objectContaining({ code: "NOT_FOUND" })
    );
  });
});
