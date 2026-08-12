import {
  cancelSetup,
  lastMeaningfulLine,
  startSetup,
  submitSetupCode,
  type SetupChild,
} from "@/lib/dyndns";
import { appError } from "@/lib/errors";

export type SetupState = "awaiting_authorization" | "completed" | "failed";

export interface SetupSessionView {
  domain: string;
  authUrl: string | null;
  state: SetupState;
  startedAt: string;
  error: string | null;
}

interface SessionInternal extends SetupSessionView {
  child: SetupChild;
  timeout: NodeJS.Timeout;
}

const SESSION_TIMEOUT_MS = 15 * 60 * 1000;
const sessions = new Map<string, SessionInternal>();

const toView = (s: SessionInternal): SetupSessionView => ({
  domain: s.domain,
  authUrl: s.authUrl,
  state: s.state,
  startedAt: s.startedAt,
  error: s.error,
});

const fail = (session: SessionInternal, error: string): void => {
  if (session.state !== "awaiting_authorization") {
    return;
  }
  session.state = "failed";
  session.error = error;
  clearTimeout(session.timeout);
  cancelSetup(session.child.proc);
};

export function getSession(domain: string): SetupSessionView | null {
  const session = sessions.get(domain);
  return session ? toView(session) : null;
}

export function startSetupSession(domain: string): SetupSessionView {
  const existing = sessions.get(domain);
  if (existing && existing.state === "awaiting_authorization") {
    throw appError("CONFLICT", `A setup for ${domain} is already in progress.`);
  }
  if (existing) {
    sessions.delete(domain);
  }

  const child = startSetup(domain);
  const session: SessionInternal = {
    domain,
    authUrl: null,
    state: "awaiting_authorization",
    startedAt: new Date().toISOString(),
    error: null,
    child,
    timeout: setTimeout(
      () => fail(session, "Authorization timed out."),
      SESSION_TIMEOUT_MS
    ),
  };
  sessions.set(domain, session);

  child.url
    .then((url) => {
      session.authUrl = url;
    })
    .catch(() => {
      // early exit without a URL: let `done` report the actual failure
    });

  child.done
    .then((result) => {
      if (session.state !== "awaiting_authorization") {
        return;
      }
      const last =
        lastMeaningfulLine(result.stdout, result.stderr) ||
        "Setup finished without a result.";
      if (last.includes("successfully configured")) {
        session.state = "completed";
        clearTimeout(session.timeout);
      } else {
        fail(session, last);
      }
    })
    .catch((err: unknown) => {
      fail(session, err instanceof Error ? err.message : "Setup failed.");
    });

  return toView(session);
}

export function submitAccessCode(
  domain: string,
  code: string
): SetupSessionView {
  const session = sessions.get(domain);
  if (!session) {
    throw appError(
      "NOT_FOUND",
      `No setup session for ${domain}. Start the setup again.`
    );
  }
  if (session.state !== "awaiting_authorization") {
    throw appError(
      "CONFLICT",
      `Setup for ${domain} is not awaiting an access code.`
    );
  }
  submitSetupCode(session.child.proc, code);
  return toView(session);
}
