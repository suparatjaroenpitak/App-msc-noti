import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import { ensureRateLimit } from "@/lib/api/handler";

/**
 * POST /api/auth/token — exchange email + password for a bearer token.
 * Used by the React Native app (native apps cannot rely on cookies).
 * Same Session table as cookie login; no CSRF/origin check needed because
 * the request never carries ambient credentials.
 */
export async function POST(req: Request) {
  try {
    ensureRateLimit(req, "login", 10, 600); // same bucket as password login

    const body = await req.json();
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
