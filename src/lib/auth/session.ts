import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateToken, hashToken } from "./password";

const COOKIE_NAME = "stock_alert_session";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

export function sessionCookieName(): string {
  return COOKIE_NAME;
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Create a DB-backed session and return the raw token (set as HttpOnly cookie by the caller). */
export async function createSession(userId: string, userAgent?: string | null): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: userAgent?.slice(0, 255) ?? null },
  });
  return { token, expiresAt };
}

/** Resolve the current user from the session cookie. Returns null when absent/expired. */
export async function getSessionUser(req: NextRequest | Request): Promise<{ id: string; email: string; name: string; image: string | null } | null> {
  const rawCookie = req.headers.get("cookie");
  if (!rawCookie) return null;
  const match = rawCookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  return { id: session.user.id, email: session.user.email, name: session.user.name, image: session.user.image };
}

/** Delete the current session (logout). */
export async function destroySession(req: NextRequest | Request): Promise<void> {
  const rawCookie = req.headers.get("cookie");
  if (!rawCookie) return;
  const match = rawCookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${COOKIE_NAME}=`));
  if (!match) return;
  const token = decodeURIComponent(match.slice(COOKIE_NAME.length + 1));
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

/** Purge expired sessions and reset tokens (call from worker or a cron route). */
export async function purgeExpiredAuthRecords(): Promise<void> {
  const now = new Date();
  await prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lte: now } } });
}
