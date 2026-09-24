import { prisma } from "@/lib/db/prisma";
import { HttpError, fail, forbidden, rateLimited, unauthorized } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";
import { clientIp, rateLimit, sweepRateLimits } from "@/lib/security/rate-limit";

/** Shared helpers for all route handlers. */

export async function requireUser(req: Request): Promise<{ id: string; email: string; name: string; image: string | null }> {
  const user = await getSessionUser(req);
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Authentication required");
  return user;
}

/** Fixed-window rate limit guard; throws HttpError(429) when exceeded. */
export function ensureRateLimit(req: Request, bucket: string, limit: number, windowSeconds: number): void {
  sweepRateLimits();
  const userKey = clientIp(req);
  const res = rateLimit(`${bucket}:${userKey}`, limit, windowSeconds);
  if (!res.allowed) throw rateLimited(res.retryAfter);
}

/** Per-user rate limit for authenticated, expensive endpoints. */
export function ensureUserRateLimit(userId: string, bucket: string, limit: number, windowSeconds: number): void {
  sweepRateLimits();
  const res = rateLimit(`${bucket}:user:${userId}`, limit, windowSeconds);
  if (!res.allowed) throw rateLimited(res.retryAfter);
}

/**
 * CSRF defense for cookie-based auth on mutating requests:
 * SameSite=Lax already blocks most cross-site posts; additionally verify Origin/Referer
 * when present. Requests without either header (native tools) are allowed.
 */
export function assertSameOrigin(req: Request): void {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (!origin && !referer) return; // non-browser client
  const candidate = origin ?? referer ?? "";
  try {
    if (appUrl && new URL(candidate).host === new URL(appUrl).host) return;
  } catch {
    /* fallthrough */
  }
  // Also allow same-host as the request itself (proxies/ports).
  const host = req.headers.get("host");
  if (host && candidate) {
    try {
      if (new URL(candidate).host === host) return;
      throw forbidden();
    } catch (e) {
      if (e instanceof HttpError) throw e;
    }
  }
  if (origin || referer) throw forbidden();
}
