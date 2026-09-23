import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Consistent API envelope: { ok, data } | { ok:false, error:{code,message,details?} } */

export type ApiError = {
  code:
    | "BAD_REQUEST"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "PAYLOAD_TOO_LARGE"
    | "UNSUPPORTED_MEDIA_TYPE"
    | "RATE_LIMITED"
    | "INTERNAL_ERROR";
  message: string;
  details?: unknown;
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true as const, data }, init);
}

export function fail(status: number, code: ApiError["code"], message: string, details?: unknown): NextResponse {
  return NextResponse.json(
    { ok: false as const, error: { code, message, ...(details !== undefined ? { details } : {}) } },
    { status },
  );
}

export const unauthorized = () => fail(401, "UNAUTHORIZED", "Authentication required");
export const forbidden = () => fail(403, "FORBIDDEN", "You do not have access to this resource");
export const notFound = (what = "Resource") => fail(404, "NOT_FOUND", `${what} not found`);

/** Map thrown errors to consistent responses. Never leaks internals in production. */
export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ZodError) {
    return fail(400, "BAD_REQUEST", "Validation failed", err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
  }
  if (err instanceof HttpError) {
    return fail(err.status, err.code, err.message, err.details);
  }
  console.error("[api] unhandled error:", err instanceof Error ? err.stack : err);
  return fail(
    500,
    "INTERNAL_ERROR",
    process.env.NODE_ENV === "production" ? "Internal server error" : String(err instanceof Error ? err.message : err),
  );
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ApiError["code"],
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, "BAD_REQUEST", message, details);
export const conflict = (message: string) => new HttpError(409, "CONFLICT", message);
export const rateLimited = (retryAfterSeconds: number) =>
  new HttpError(429, "RATE_LIMITED", "Too many requests, please try again later", { retryAfterSeconds });
