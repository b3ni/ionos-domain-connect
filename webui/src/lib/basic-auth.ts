import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Optional HTTP Basic authentication for the whole web UI.
 *
 * Enabled only when WEBUI_PASSWORD is set (the entrypoint also fills it from
 * WEBUI_PASSWORD_FILE); the username is WEBUI_USERNAME, default "admin".
 * Read on every request so the value comes from the container's runtime
 * environment, never from the build.
 */
export interface AuthConfig {
  username: string;
  password: string;
}

export function authConfig(
  env: Record<string, string | undefined> = process.env
): AuthConfig | null {
  const password = env.WEBUI_PASSWORD;
  if (!password) {
    return null;
  }
  return { username: env.WEBUI_USERNAME || "admin", password };
}

/** Constant-time comparison (hashing first makes the lengths equal). */
function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHash("sha256").update(s, "utf8").digest();
  return timingSafeEqual(digest(a), digest(b));
}

/** Checks an `Authorization: Basic …` header against the configured credentials. */
export function isAuthorized(header: string | null, config: AuthConfig): boolean {
  const match = header?.match(/^Basic\s+([A-Za-z0-9+/=]+)\s*$/i);
  if (!match) {
    return false;
  }
  const decoded = Buffer.from(match[1], "base64").toString("utf8");
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return false;
  }
  // Evaluate both comparisons so timing does not reveal which one failed.
  const userOk = safeEqual(decoded.slice(0, separator), config.username);
  const passwordOk = safeEqual(decoded.slice(separator + 1), config.password);
  return userOk && passwordOk;
}

export const AUTH_CHALLENGE = 'Basic realm="ionos-domain-connect", charset="UTF-8"';
