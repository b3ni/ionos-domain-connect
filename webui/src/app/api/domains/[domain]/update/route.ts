import { appError, errorResponse } from "@/lib/errors";
import { isManaged } from "@/lib/domains";
import { runUpdateOneNow } from "@/lib/scheduler";
import { domainParamSchema } from "@/lib/validation";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const parsed = domainParamSchema.safeParse({ domain });
    if (!parsed.success) {
      throw appError("VALIDATION", "Invalid domain in path");
    }

    if (!isManaged(parsed.data.domain)) {
      throw appError(
        "NOT_FOUND",
        `${parsed.data.domain} is not managed.`
      );
    }

    const summary = await runUpdateOneNow(parsed.data.domain);
    return Response.json({ started: true, results: summary.domains });
  } catch (error) {
    return errorResponse(error);
  }
}
