import { appError } from "@/lib/errors";

/**
 * One in-process lock for everything that writes config.json.
 *
 * The domain-connect-dyndns CLI reads the whole file, does network calls,
 * then rewrites the whole file (update: per domain; setup: after the access
 * code; remove: immediately). Any other write landing in between is silently
 * overwritten — a removed domain comes back, an editor save or a new domain
 * is lost, or a freshly rotated refresh_token is replaced by a stale one.
 *
 * - Updates use `tryWithConfigLock`: when busy they fail fast with CONFLICT
 *   (a skipped scheduled tick is harmless).
 * - User-initiated writes (editor save, remove, setup completion) use
 *   `withConfigLock` and wait their turn. Waiters are served first-come
 *   first-served and before any new update can start.
 *
 * Writes made from outside this process (e.g. `docker exec … setup`) are
 * not covered.
 */

interface LockState {
  locked: boolean;
  holder: string;
  queue: Array<() => void>;
}

// Kept on globalThis so the scheduler (loaded from instrumentation.ts) and
// the route handlers share one lock even if they end up in separate bundles.
const globalForLock = globalThis as typeof globalThis & {
  __configLock?: LockState;
};
const state: LockState = (globalForLock.__configLock ??= {
  locked: false,
  holder: "",
  queue: [],
});

export type Release = () => void;

function grant(label: string): Release {
  state.locked = true;
  state.holder = label;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = state.queue.shift();
    if (next) {
      next(); // hand over directly: the lock never becomes free in between
    } else {
      state.locked = false;
      state.holder = "";
    }
  };
}

const busyError = () =>
  appError(
    "CONFLICT",
    `Another operation is in progress (${state.holder}). Try again in a moment.`
  );

/** Takes the lock now or throws CONFLICT. */
export function tryAcquireConfigLock(label: string): Release {
  if (state.locked) {
    throw busyError();
  }
  return grant(label);
}

/** Waits up to `waitMs` for the lock, then throws CONFLICT. */
export function acquireConfigLock(label: string, waitMs: number): Promise<Release> {
  if (!state.locked) {
    return Promise.resolve(grant(label));
  }
  return new Promise((resolve, reject) => {
    const onTurn = () => {
      clearTimeout(timer);
      resolve(grant(label));
    };
    const timer = setTimeout(() => {
      const index = state.queue.indexOf(onTurn);
      if (index !== -1) state.queue.splice(index, 1);
      reject(busyError());
    }, waitMs);
    state.queue.push(onTurn);
  });
}

export async function tryWithConfigLock<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const release = tryAcquireConfigLock(label);
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function withConfigLock<T>(
  label: string,
  waitMs: number,
  fn: () => T | Promise<T>
): Promise<T> {
  const release = await acquireConfigLock(label, waitMs);
  try {
    return await fn();
  } finally {
    release();
  }
}
