import { runUpdateAll, type UpdateSummary } from "@/lib/dyndns";
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
 * Single update runner: scheduled ticks and manual triggers share one
 * lock, so two updates can never run concurrently.
 */
export async function runUpdateNow(): Promise<UpdateSummary> {
  if (running) {
    throw appError("CONFLICT", "An update is already running.");
  }
  running = true;
  const ts = new Date().toISOString();
  try {
    console.log(`[${ts}] Updating all domains ...`);
    const summary = await runUpdateAll();
    console.log(
      `[${ts}] Update finished: ${JSON.stringify(summary.domains)}`
    );
    return summary;
  } finally {
    running = false;
  }
}
