import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, fail, conflict } from "@/lib/api/response";
import { loginSchema, registerSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { ensureRateLimit } from "@/lib/api/handler";

/**
 * POST /api/auth/token — exchange email + password for a bearer token.
 * Used by the React Native app (native apps cannot rely on cookies).
 * Same Session table as cookie login; no CSRF/origin check needed because
 * the request never carries ambient credentials.
 *
 * Also accepts { name, email, password } to register a new account from the
 * mobile app (mode: "register") and returns a bearer token in one round trip.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    // Mobile registration: same validations as the web /api/auth/register route.
    if (body.mode === "register") {
      ensureRateLimit(req, "register", 5, 600); // 5 per 10 min per IP
      const { name, email, password } = registerSchema.parse(body);
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw conflict("An account with this email already exists");

      const user = await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hashPassword(password),
          notificationPreference: { create: {} },
        },
        select: { id: true, name: true, email: true },
      });
      const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
      return ok(
        { token, expiresAt: expiresAt.toISOString(), user },
        { status: 201 },
      );
    }

    ensureRateLimit(req, "login", 10, 600); // same bucket as password login

    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return fail(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
    return ok({
      token,
      expiresAt: expiresAt.toISOString(),
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** DELETE /api/auth/token — revoke the bearer token (mobile logout). */
export async function DELETE(req: Request) {
  try {
    await destroySession(req);
    return ok({ revoked: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
