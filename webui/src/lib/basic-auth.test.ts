import { describe, expect, it } from "vitest";
import { authConfig, isAuthorized } from "@/lib/basic-auth";

const basic = (credentials: string) =>
  `Basic ${Buffer.from(credentials, "utf8").toString("base64")}`;

describe("authConfig", () => {
  it("is disabled without a password", () => {
    expect(authConfig({})).toBeNull();
    expect(authConfig({ WEBUI_PASSWORD: "" })).toBeNull();
    expect(authConfig({ WEBUI_USERNAME: "bob" })).toBeNull();
  });

  it("defaults the username to admin", () => {
    expect(authConfig({ WEBUI_PASSWORD: "s3cret" })).toEqual({
      username: "admin",
      password: "s3cret",
    });
    expect(authConfig({ WEBUI_PASSWORD: "s3cret", WEBUI_USERNAME: "bob" })).toEqual({
      username: "bob",
      password: "s3cret",
    });
  });
});

describe("isAuthorized", () => {
  const config = { username: "admin", password: "pa:ss wörd" };

  it("accepts the right credentials (password may contain ':' and UTF-8)", () => {
    expect(isAuthorized(basic("admin:pa:ss wörd"), config)).toBe(true);
    expect(isAuthorized(basic("admin:pa:ss wörd").replace("Basic", "basic"), config)).toBe(true);
  });

  it.each([
    ["no header", null],
    ["wrong password", basic("admin:nope")],
    ["wrong user", basic("root:pa:ss wörd")],
    ["password prefix", basic("admin:pa:ss")],
    ["empty credentials", basic(":")],
    ["no separator", basic("adminpa:ss wörd".replace(":", ""))],
    ["other scheme", "Bearer abc"],
    ["garbage", "Basic !!!"],
  ])("rejects %s", (_name, header) => {
    expect(isAuthorized(header, config)).toBe(false);
  });
});
