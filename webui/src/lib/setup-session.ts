import { acquireConfigLock, type Release } from "@/lib/config-lock";
import {
  CLI_TIMEOUT_SEC,
  CONFIG_LOCK_WAIT_MS,
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
  codeSubmitted: boolean;
  /** Config lock held from code submission until the CLI exits. */
  releaseLock: Release | null;
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
  // The config lock (if held) is released when the killed process exits.
  cancelSetup(session.child.proc);
};

const releaseLock = (session: SessionInternal): void => {
  session.releaseLock?.();
  session.releaseLock = null;
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
    codeSubmitted: false,
    releaseLock: null,
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
      releaseLock(session);
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

const notAwaiting = (domain: string) =>
  appError("CONFLICT", `Setup for ${domain} is not awaiting an access code.`);

/**
 * Hands the access code to the setup CLI. Right after exchanging it the CLI
 * rewrites config.json, so the config lock is taken first (waiting for a
 * running update) and held until the CLI exits.
 */
export async function submitAccessCode(
  domain: string,
  code: string
): Promise<SetupSessionView> {
  const session = sessions.get(domain);
  if (!session) {
    throw appError(
      "NOT_FOUND",
      `No setup session for ${domain}. Start the setup again.`
    );
  }
  if (session.state !== "awaiting_authorization") {
    throw notAwaiting(domain);
  }
  if (session.codeSubmitted) {
    throw appError(
      "CONFLICT",
      `An access code for ${domain} was already submitted.`
    );
  }
  session.codeSubmitted = true;

  let release: Release;
  try {
    release = await acquireConfigLock(
      `finishing setup for ${domain}`,
      CONFIG_LOCK_WAIT_MS
    );
  } catch (error) {
    session.codeSubmitted = false;
    throw error;
  }
  // The session may have timed out or failed while waiting for the lock.
  if (session.state !== "awaiting_authorization") {
    release();
    throw notAwaiting(domain);
  }
  session.releaseLock = release;
  // Bound how long the lock can be held by a CLI stuck on the provider.
  clearTimeout(session.timeout);
  session.timeout = setTimeout(
    () =>
      fail(
        session,
        `Setup did not finish within ${CLI_TIMEOUT_SEC}s after the access code was submitted.`
      ),
    CLI_TIMEOUT_SEC * 1000
  );
  submitSetupCode(session.child.proc, code);
  return toView(session);
}
