import { errorResponse } from "@/lib/errors";
import { runUpdateNow } from "@/lib/scheduler";

export async function POST() {
  try {
    const summary = await runUpdateNow();
    return Response.json({ started: true, results: summary.domains });
  } catch (error) {
    return errorResponse(error);
  }
}
