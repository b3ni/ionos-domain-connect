import { NextResponse, type NextRequest } from "next/server";
import { AUTH_CHALLENGE, authConfig, isAuthorized } from "@/lib/basic-auth";

/**
 * Runs before every request.
 *
 * 1. Optional HTTP Basic auth (`WEBUI_PASSWORD`, see lib/basic-auth.ts) for
 *    every page, API route and asset. Without it the interface is open to
 *    anyone who can reach the port.
 * 2. CSRF guard for the API. Browsers resend Basic credentials (or none are
 *    needed at all), so without this any website opened in a browser on the
 *    same network could drive the API cross-site (e.g. a hidden form POST
 *    to http://<host>:3000/api/...).
 *
 * State-changing requests are rejected when the browser says they come from
 * another site:
 * - `Sec-Fetch-Site` (sent on HTTPS/localhost) must be same-origin or none;
 * - otherwise `Origin`, when present, must match the requested host
 *   (`Host` or, behind a reverse proxy, `X-Forwarded-Host`).
 * Requests without either header (curl, scripts) are not browser-driven and
 * pass through.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function forbidden(reason: string) {
  return NextResponse.json(
    {
      error: {
        code: "FORBIDDEN",
        message: `Cross-site request rejected: ${reason}`,
        details: null,
      },
    },
    { status: 403 }
  );
}

function unauthorized() {
  return NextResponse.json(
    {
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
        details: null,
      },
    },
    { status: 401, headers: { "WWW-Authenticate": AUTH_CHALLENGE } }
  );
}

export function proxy(request: NextRequest) {
  const auth = authConfig();
  if (auth && !isAuthorized(request.headers.get("authorization"), auth)) {
    return unauthorized();
  }

  if (
    SAFE_METHODS.has(request.method) ||
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    return NextResponse.next();
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) {
    return fetchSite === "same-origin" || fetchSite === "none"
      ? NextResponse.next()
      : forbidden(`Sec-Fetch-Site is ${fetchSite}`);
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host.toLowerCase();
    } catch {
      return forbidden(`invalid Origin ${origin}`);
    }
    const hosts = [
      request.headers.get("host"),
      ...(request.headers.get("x-forwarded-host") ?? "").split(","),
    ]
      .map((h) => h?.trim().toLowerCase())
      .filter(Boolean);
    if (!hosts.includes(originHost)) {
      return forbidden(`Origin ${origin} does not match this host`);
    }
  }

  return NextResponse.next();
}

// No matcher: auth must cover every path, pages and static assets included.
