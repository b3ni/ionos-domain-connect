import { appError, errorResponse } from "@/lib/errors";
import { isManaged } from "@/lib/domains";
import { removeDomain } from "@/lib/dyndns";
import { domainParamSchema } from "@/lib/validation";

export async function DELETE(
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

    const result = await removeDomain(parsed.data.domain);
    const lastLine = result.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .pop() ?? "";

    if (lastLine.includes("successfully removed")) {
      return Response.json({ removed: parsed.data.domain });
    }
    if (lastLine.includes("not configured")) {
      throw appError(
        "NOT_FOUND",
        `${parsed.data.domain} is not managed.`
      );
    }
    throw appError(
      "CLI_ERROR",
      lastLine || "The domain could not be removed."
    );
  } catch (error) {
    return errorResponse(error);
  }
}
