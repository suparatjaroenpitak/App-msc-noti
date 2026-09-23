import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, badRequest } from "@/lib/api/response";
import { changePasswordSchema } from "@/lib/validation/schemas";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser, assertSameOrigin, ensureUserRateLimit } from "@/lib/api/handler";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const sessionUser = await requireUser(req);
    ensureUserRateLimit(sessionUser.id, "change-password", 5, 3600);

    const { currentPassword, newPassword } = changePasswordSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      throw badRequest("Current password is incorrect");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword) },
    });
    // Invalidate all other sessions after password change.
    await prisma.session.deleteMany({ where: { userId: user.id } });

    return ok({ changed: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
