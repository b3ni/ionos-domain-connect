import { tryWithConfigLock } from "@/lib/config-lock";
import { runUpdateAll, runUpdateOne, type UpdateSummary } from "@/lib/dyndns";
import { AppError } from "@/lib/errors";

let timer: NodeJS.Timeout | null = null;
let started = false;

export function startScheduler(): void {
  if (started) {
    return;
  }
  started = true;
  const intervalSec = Number(process.env.INTERVAL_UPDATE ?? "60");
  const intervalMs = Math.max(intervalSec * 1000, 1000);
  timer = setInterval(() => {
    runUpdateNow().catch((error: unknown) => {
      if (error instanceof AppError && error.code === "CONFLICT") {
        console.log(
          `[${new Date().toISOString()}] Scheduled update skipped: ${error.message}`
        );
        return;
      }
      console.error(
        `[${new Date().toISOString()}] Scheduled update failed:`,
        error
      );
    });
  }, intervalMs);
  console.log(`[scheduler] started, update interval ${intervalSec}s`);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Runs an update under the shared config lock (`config-lock.ts`): updates
 * never overlap each other nor any other config write, and fail fast with
 * CONFLICT when the lock is taken.
 */
function withUpdateLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return tryWithConfigLock(label, async () => {
    const ts = new Date().toISOString();
    console.log(`[${ts}] ${label} ...`);
    const result = await fn();
    console.log(`[${ts}] Update finished`);
    return result;
  });
}

export function runUpdateNow(): Promise<UpdateSummary> {
  return withUpdateLock("updating all domains", runUpdateAll);
}

export function runUpdateOneNow(domain: string): Promise<UpdateSummary> {
  return withUpdateLock(`updating ${domain}`, () => runUpdateOne(domain));
}
