import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

const HOST = "192.168.1.10:3000";

function request(method: string, headers: Record<string, string>, path = "/api/update") {
  return proxy(
    new NextRequest(`http://${HOST}${path}`, {
      method,
      headers: { host: HOST, ...headers },
    })
  );
}

const status = (method: string, headers: Record<string, string>, path?: string) =>
  request(method, headers, path).status;

const basic = (credentials: string) =>
  `Basic ${Buffer.from(credentials).toString("base64")}`;

beforeEach(() => {
  vi.stubEnv("WEBUI_PASSWORD", "");
  vi.stubEnv("WEBUI_USERNAME", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it("only guards the API", () => {
    expect(status("POST", { origin: "http://evil.example" }, "/")).toBe(200);
  });
});

describe("proxy (optional basic auth)", () => {
  it("lets everything through when WEBUI_PASSWORD is not set", () => {
    expect(status("GET", {}, "/")).toBe(200);
    expect(status("GET", {}, "/api/config")).toBe(200);
  });

  describe("with WEBUI_PASSWORD set", () => {
    beforeEach(() => {
      vi.stubEnv("WEBUI_PASSWORD", "s3cret");
    });

    it.each(["/", "/api/config", "/api/domains", "/_next/static/chunks/app.js", "/favicon.ico"])(
      "challenges unauthenticated requests to %s",
      (path) => {
        const response = request("GET", {}, path);
        expect(response.status).toBe(401);
        expect(response.headers.get("www-authenticate")).toMatch(/^Basic realm=/);
      }
    );

    it("rejects wrong credentials", () => {
      expect(status("GET", { authorization: basic("admin:wrong") }, "/")).toBe(401);
      expect(status("GET", { authorization: basic("other:s3cret") }, "/")).toBe(401);
    });

    it("accepts the right credentials, honouring WEBUI_USERNAME", () => {
      expect(status("GET", { authorization: basic("admin:s3cret") }, "/api/config")).toBe(200);
      vi.stubEnv("WEBUI_USERNAME", "bob");
      expect(status("GET", { authorization: basic("admin:s3cret") }, "/")).toBe(401);
      expect(status("GET", { authorization: basic("bob:s3cret") }, "/")).toBe(200);
    });

    it("still applies the cross-site guard to authenticated requests", () => {
      // Browsers resend cached Basic credentials on cross-site requests.
      const authorization = basic("admin:s3cret");
      expect(status("POST", { authorization, origin: "http://evil.example" })).toBe(403);
      expect(status("POST", { authorization, origin: `http://${HOST}` })).toBe(200);
    });

    it("answers 401 before revealing the cross-site check", () => {
      expect(status("POST", { origin: "http://evil.example" })).toBe(401);
    });
  });
});
