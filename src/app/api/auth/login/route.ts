import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { loginSchema } from "@/lib/validation/schemas";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { assertSameOrigin, ensureRateLimit } from "@/lib/api/handler";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    ensureRateLimit(req, "login", 10, 600); // 10 per 10 min per IP

    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({ where: { email } });
    // Uniform error to avoid account enumeration; still rate limited above.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return fail(401, "UNAUTHORIZED", "Invalid email or password");
    }

    const { token, expiresAt } = await createSession(user.id, req.headers.get("user-agent"));
    const res = ok({ user: { id: user.id, name: user.name, email: user.email } });
    res.cookies.set(sessionCookieName(), token, sessionCookieOptions(Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
