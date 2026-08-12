import { appError, errorResponse } from "@/lib/errors";
import { getSession } from "@/lib/setup-session";
import { domainParamSchema } from "@/lib/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const parsed = domainParamSchema.safeParse({ domain });
    if (!parsed.success) {
      throw appError("VALIDATION", "Invalid domain in path");
    }
    const session = getSession(parsed.data.domain);
    if (!session) {
      throw appError(
        "NOT_FOUND",
        `No setup session for ${parsed.data.domain}.`
      );
    }
    return Response.json(session);
  } catch (error) {
    return errorResponse(error);
  }
}
