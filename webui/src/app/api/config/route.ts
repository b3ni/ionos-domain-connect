import { CONFIG_PATH, readConfigState, saveConfig } from "@/lib/config-store";
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
    const { backupPath } = saveConfig(raw, baseRaw);

    return Response.json({
      path: CONFIG_PATH,
      savedAt: Date.now(),
      backupPath,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
