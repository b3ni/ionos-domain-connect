import { withConfigLock } from "@/lib/config-lock";
import { CONFIG_PATH, readConfigState, saveConfig } from "@/lib/config-store";
import { CONFIG_LOCK_WAIT_MS } from "@/lib/dyndns";
import { appError, errorResponse } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(readConfigState());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw appError("VALIDATION", "Request body must be JSON.");
    }

    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as { raw?: unknown }).raw !== "string" ||
      !("baseRaw" in body) ||
      ((body as { baseRaw?: unknown }).baseRaw !== null &&
        typeof (body as { baseRaw?: unknown }).baseRaw !== "string")
    ) {
      throw appError(
        "VALIDATION",
        "Request body must be { raw: string, baseRaw: string | null }."
      );
    }

    const { raw, baseRaw } = body as { raw: string; baseRaw: string | null };
    // Waits for a running update: the CLI would otherwise overwrite this
    // save when it rewrites the file. If the update changed the file, the
    // baseRaw check then reports a conflict instead of losing either side.
    const { backupPath } = await withConfigLock(
      "saving the configuration",
      CONFIG_LOCK_WAIT_MS,
      () => saveConfig(raw, baseRaw)
    );

    return Response.json({
      path: CONFIG_PATH,
      savedAt: Date.now(),
      backupPath,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
