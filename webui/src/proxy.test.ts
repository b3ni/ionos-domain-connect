import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

const HOST = "192.168.1.10:3000";

function status(method: string, headers: Record<string, string>) {
  const request = new NextRequest(`http://${HOST}/api/update`, {
    method,
    headers: { host: HOST, ...headers },
  });
  return proxy(request).status;
}

describe("proxy (cross-site guard)", () => {
  it.each([
    ["foreign Origin (hidden form on another site)", { origin: "http://evil.example" }],
    ["Origin with a different port", { origin: "http://192.168.1.10:8080" }],
    ["Origin: null (sandboxed iframe / file://)", { origin: "null" }],
    ["Sec-Fetch-Site: cross-site", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site: same-site (sibling subdomain)", { "sec-fetch-site": "same-site" }],
  ])("rejects %s", (_name, headers) => {
    expect(status("POST", headers)).toBe(403);
    expect(status("DELETE", headers)).toBe(403);
    expect(status("PUT", headers)).toBe(403);
  });

  it.each([
    ["same-origin page on plain http (Origin only)", { origin: `http://${HOST}` }],
    [
      "same-origin page on https (Sec-Fetch-Site wins over Origin)",
      { "sec-fetch-site": "same-origin", origin: "https://dns.example.com" },
    ],
    ["user-typed navigation", { "sec-fetch-site": "none" }],
    [
      "reverse proxy forwarding the public host",
      { origin: "https://dns.example.com", "x-forwarded-host": "dns.example.com" },
    ],
    ["curl or a script (no browser headers)", {}],
  ])("allows %s", (_name, headers) => {
    expect(status("POST", headers)).toBe(200);
  });

  it("never blocks read-only requests", () => {
    expect(status("GET", { origin: "http://evil.example" })).toBe(200);
    expect(status("HEAD", { "sec-fetch-site": "cross-site" })).toBe(200);
  });
});
