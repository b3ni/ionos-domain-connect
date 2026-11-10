import { NextResponse, type NextRequest } from "next/server";

/**
 * CSRF guard for the API. The interface has no authentication, so without
 * this any website opened in a browser on the same network could drive the
 * API cross-site (e.g. a hidden form POST to http://<host>:3000/api/...).
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

export function proxy(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) {
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

export const config = {
  matcher: "/api/:path*",
};
