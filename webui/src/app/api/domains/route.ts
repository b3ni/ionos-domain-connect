import { getDomains, isManaged } from "@/lib/domains";
import { appError, errorResponse } from "@/lib/errors";
import {
  getSession,
  startSetupSession,
  submitAccessCode,
} from "@/lib/setup-session";
import { addDomainSchema, setupCodeSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getDomains());
}

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw appError("VALIDATION", "Request body must be JSON.");
    }

    const parsed = addDomainSchema.safeParse(body);
    if (!parsed.success) {
      throw appError(
        "VALIDATION",
        "Invalid domain",
        parsed.error.flatten().fieldErrors
      );
    }
    const { domain } = parsed.data;

    if (isManaged(domain)) {
      throw appError("CONFLICT", `${domain} is already managed.`);
    }

    const rawCode =
      typeof body === "object" && body !== null && "code" in body
        ? (body as { code?: unknown }).code
        : undefined;

    if (typeof rawCode === "string" && rawCode.trim() !== "") {
      const codeParsed = setupCodeSchema.safeParse({ code: rawCode });
      if (!codeParsed.success) {
        throw appError("VALIDATION", "Invalid access code");
      }
      submitAccessCode(domain, codeParsed.data.code);
    } else {
      startSetupSession(domain);
    }

    const session = getSession(domain);
    if (!session) {
      throw appError("INTERNAL", "Setup session was not created.");
    }
    return Response.json(session, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
