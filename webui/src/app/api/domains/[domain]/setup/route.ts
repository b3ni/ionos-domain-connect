import { appError, errorResponse } from "@/lib/errors";
import { isManaged } from "@/lib/domains";
import {
  getSession,
  startSetupSession,
  submitAccessCode,
} from "@/lib/setup-session";
import { domainParamSchema, setupCodeSchema } from "@/lib/validation";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const parsed = domainParamSchema.safeParse({ domain });
    if (!parsed.success) {
      throw appError("VALIDATION", "Invalid domain in path");
    }

    // The add flow submits its code while the domain is not yet in the
    // config (the CLI writes it when setup completes), so the managed
    // check only applies when no setup session is in progress (re-setup
    // entry point protection, feature 005).
    if (!getSession(parsed.data.domain) && !isManaged(parsed.data.domain)) {
      throw appError(
        "NOT_FOUND",
        `${parsed.data.domain} is not managed.`
      );
    }

    let rawCode: unknown;
    try {
      const body = (await request.json()) as { code?: unknown };
      rawCode = body?.code;
    } catch {
      rawCode = undefined;
    }

    if (typeof rawCode === "string" && rawCode.trim() !== "") {
      const codeParsed = setupCodeSchema.safeParse({ code: rawCode });
      if (!codeParsed.success) {
        throw appError("VALIDATION", "Invalid access code");
      }
      submitAccessCode(parsed.data.domain, codeParsed.data.code);
    } else {
      startSetupSession(parsed.data.domain);
    }

    const session = getSession(parsed.data.domain);
    if (!session) {
      throw appError("INTERNAL", "Setup session was not created.");
    }
    return Response.json(session);
  } catch (error) {
    return errorResponse(error);
  }
}
