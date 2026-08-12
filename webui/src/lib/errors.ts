export type ErrorCode =
  | "VALIDATION"
  | "CONFLICT"
  | "NOT_FOUND"
  | "CLI_ERROR"
  | "INTERNAL";

export class AppError extends Error {
  code: ErrorCode;
  details: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details ?? null;
  }
}

export function appError(
  code: ErrorCode,
  message: string,
  details?: unknown
): AppError {
  return new AppError(code, message, details);
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  CONFLICT: 409,
  NOT_FOUND: 404,
  CLI_ERROR: 502,
  INTERNAL: 500,
};

export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: STATUS_BY_CODE[error.code] }
    );
  }

  const message =
    error instanceof Error ? error.message : "Unexpected internal error";
  return Response.json(
    {
      error: { code: "INTERNAL", message, details: null },
    },
    { status: 500 }
  );
}
