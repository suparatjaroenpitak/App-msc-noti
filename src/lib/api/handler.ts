import { prisma } from "@/lib/db/prisma";
import { rateLimited } from "@/lib/api/response";
import { clientIp, rateLimit, sweepRateLimits } from "@/lib/security/rate-limit";

/**
 * Shared helpers for all route handlers.
 *
 * Authentication/authorization has been removed entirely:
 * every request is bound to the instance's single "default user"
 * (created automatically on first use). The Session/PasswordResetToken
 * models still exist in the schema but are no longer used.
 */

const DEFAULT_EMAIL = "demo@example.com";
const DEFAULT_NAME = "ผู้ใช้ในเครื่อง";

/** The single implicit user of this instance (auto-created on first call). */
export async function requireUser(_req?: Request): Promise<{ id: string; email: string; name: string; image: string | null }> {
  const existing = await prisma.user.findUnique({ where: { email: DEFAULT_EMAIL } });
  if (existing) {
    return { id: existing.id, email: existing.email, name: existing.name, image: existing.image };
  }
  const created = await prisma.user.create({
    // passwordHash is a schema-required legacy column (auth removed) — store an unusable random value.
    data: { email: DEFAULT_EMAIL, name: DEFAULT_NAME, passwordHash: `disabled:${crypto.randomUUID()}` },
  });
  return { id: created.id, email: created.email, name: created.name, image: created.image };
}

/** Fixed-window rate limit guard; throws HttpError(429) when exceeded. */
export function ensureRateLimit(req: Request, bucket: string, limit: number, windowSeconds: number): void {
  sweepRateLimits();
  const userKey = clientIp(req);
  const res = rateLimit(`${bucket}:${userKey}`, limit, windowSeconds);
  if (!res.allowed) throw rateLimited(res.retryAfter);
}

/** Per-user rate limit for expensive endpoints. */
export function ensureUserRateLimit(userId: string, bucket: string, limit: number, windowSeconds: number): void {
  sweepRateLimits();
  const res = rateLimit(`${bucket}:user:${userId}`, limit, windowSeconds);
  if (!res.allowed) throw rateLimited(res.retryAfter);
}
