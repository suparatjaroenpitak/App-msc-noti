import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, conflict } from "@/lib/api/response";
import { registerSchema } from "@/lib/validation/schemas";
import { hashPassword } from "@/lib/auth/password";
import { createSession, sessionCookieName, sessionCookieOptions } from "@/lib/auth/session";
import { assertSameOrigin, ensureRateLimit } from "@/lib/api/handler";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    ensureRateLimit(req, "register", 5, 600); // 5 per 10 min per IP

    const body = await req.json();
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
    const res = ok({ user }, { status: 201 });
    res.cookies.set(sessionCookieName(), token, sessionCookieOptions(Math.floor((expiresAt.getTime() - Date.now()) / 1000)));
    return res;
  } catch (err) {
    return toErrorResponse(err);
  }
}
