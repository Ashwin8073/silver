import type {
  Request,
  Response,
  NextFunction
} from "express";

interface HttpError {
  status?: number;
  type?: string;
}

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    return;
  }

  const httpError = error as HttpError | null;

  if (
    error instanceof SyntaxError &&
    httpError?.status === 400 &&
    httpError?.type === "entity.parse.failed"
  ) {
    res.status(400).json({
      success: false,
      code: "INVALID_JSON",
      message: "Malformed JSON request body"
    });
    return;
  }

  console.error(
    "Unhandled API error:",
    error instanceof Error ? error.name : "Unknown"
  );

  res.status(500).json({
    success: false,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error"
  });
}
