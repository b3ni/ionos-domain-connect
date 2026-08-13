import { runUpdateAll, runUpdateOne, type UpdateSummary } from "@/lib/dyndns";
import { appError } from "@/lib/errors";

let timer: NodeJS.Timeout | null = null;
let started = false;
let running = false;

export function startScheduler(): void {
  if (started) {
    return;
  }
  started = true;
  const intervalSec = Number(process.env.INTERVAL_UPDATE ?? "60");
  const intervalMs = Math.max(intervalSec * 1000, 1000);
  timer = setInterval(() => {
    void runUpdateNow();
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
 * Runs an update under the single shared lock: scheduled ticks, global
 * and per-domain manual triggers can never run concurrently.
 */
async function withLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (running) {
    throw appError("CONFLICT", "An update is already running.");
  }
  running = true;
  const ts = new Date().toISOString();
  try {
    console.log(`[${ts}] ${label}`);
    const result = await fn();
    console.log(`[${ts}] Update finished`);
    return result;
  } finally {
    running = false;
  }
}

export function runUpdateNow(): Promise<UpdateSummary> {
  return withLock("Updating all domains ...", runUpdateAll);
}

export function runUpdateOneNow(domain: string): Promise<UpdateSummary> {
  return withLock(`Updating ${domain} ...`, () => runUpdateOne(domain));
}
