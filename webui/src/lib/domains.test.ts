import { afterEach, describe, expect, it, vi } from "vitest";
import { importWithEnv, tempWorkspace } from "@/test/helpers";
import { DEFAULT_SORT, sortDomains, toggleSortState } from "@/lib/sort";
import type { DomainView } from "@/lib/domains";

type Domains = typeof import("@/lib/domains");

afterEach(() => {
  vi.unstubAllEnvs();
});

async function domainsFor(config: unknown) {
  const ws = tempWorkspace(config);
  const mod = await importWithEnv<Domains>("@/lib/domains", { CONFIG_PATH: ws.configPath });
  return mod.getDomains();
}

describe("getDomains", () => {
  it("derives status, error and IP from the CLI's fields", async () => {
    const { domains, configError } = await domainsFor({
      "ok.example.com": { last_success: 200, last_attempt: 100, ip: { IPv4: "203.0.113.1" } },
      "err.example.com": { last_success: 100, last_attempt: 200, last_error: "boom" },
      "err-noreason.example.com": { last_attempt: 200 },
      "pending.example.com": { last_dns_check: 50, ip: { IP: "203.0.113.2" } },
      "new.example.com": {},
    });
    expect(configError).toBeNull();
    const byName = Object.fromEntries(domains.map((d) => [d.name, d]));

    expect(byName["ok.example.com"]).toMatchObject({
      lastResult: "ok",
      lastError: null,
      currentIp: "203.0.113.1",
      lastUpdatedAt: new Date(200_000).toISOString(),
    });
    expect(byName["err.example.com"]).toMatchObject({ lastResult: "error", lastError: "boom" });
    expect(byName["err-noreason.example.com"].lastError).toMatch(/No error details/);
    expect(byName["pending.example.com"]).toMatchObject({
      lastResult: "pending",
      currentIp: "203.0.113.2",
    });
    expect(byName["new.example.com"]).toMatchObject({ lastResult: null, lastUpdatedAt: null });
  });

  it("reports an unreadable config instead of throwing", async () => {
    expect(await domainsFor("{broken")).toEqual({
      domains: [],
      configError: "Could not read config file",
    });
  });
});

const view = (name: string, extra: Partial<DomainView> = {}): DomainView => ({
  name,
  lastUpdatedAt: null,
  lastResult: null,
  lastError: null,
  currentIp: null,
  ...extra,
});

describe("sortDomains", () => {
  const names = (list: DomainView[]) => list.map((d) => d.name);

  it("sorts names case-insensitively, with a stable tie-break", () => {
    const list = [view("b.example.com"), view("A.example.com"), view("a.example.com")];
    expect(names(sortDomains(list, DEFAULT_SORT))).toEqual([
      "a.example.com",
      "A.example.com",
      "b.example.com",
    ]);
  });

  it("keeps missing values last in both directions", () => {
    const list = [
      view("none"),
      view("old", { lastUpdatedAt: "2026-01-01T00:00:00.000Z" }),
      view("new", { lastUpdatedAt: "2026-06-01T00:00:00.000Z" }),
    ];
    expect(names(sortDomains(list, { key: "lastUpdatedAt", direction: "asc" }))).toEqual([
      "old",
      "new",
      "none",
    ]);
    expect(names(sortDomains(list, { key: "lastUpdatedAt", direction: "desc" }))).toEqual([
      "new",
      "old",
      "none",
    ]);
  });

  it("orders status ok < pending < error", () => {
    const list = [
      view("e", { lastResult: "error" }),
      view("o", { lastResult: "ok" }),
      view("p", { lastResult: "pending" }),
    ];
    expect(names(sortDomains(list, { key: "lastResult", direction: "asc" }))).toEqual([
      "o",
      "p",
      "e",
    ]);
  });

  it("does not mutate its input", () => {
    const list = [view("b"), view("a")];
    sortDomains(list, DEFAULT_SORT);
    expect(names(list)).toEqual(["b", "a"]);
  });

  it("toggles direction on the same key and resets on a new one", () => {
    expect(toggleSortState(DEFAULT_SORT, "name")).toEqual({ key: "name", direction: "desc" });
    expect(toggleSortState({ key: "name", direction: "desc" }, "currentIp")).toEqual({
      key: "currentIp",
      direction: "asc",
    });
  });
});
