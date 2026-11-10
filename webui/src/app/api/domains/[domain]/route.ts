import { appError, errorResponse } from "@/lib/errors";
import { withConfigLock } from "@/lib/config-lock";
import { isManaged } from "@/lib/domains";
import { CONFIG_LOCK_WAIT_MS, removeDomain } from "@/lib/dyndns";
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

    // Under the config lock: a concurrent update would otherwise rewrite
    // the file from its stale copy and bring the domain back.
    const result = await withConfigLock(
      `removing ${parsed.data.domain}`,
      CONFIG_LOCK_WAIT_MS,
      () => {
        if (!isManaged(parsed.data.domain)) {
          throw appError(
            "NOT_FOUND",
            `${parsed.data.domain} is not managed.`
          );
        }
        return removeDomain(parsed.data.domain);
      }
    );
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
