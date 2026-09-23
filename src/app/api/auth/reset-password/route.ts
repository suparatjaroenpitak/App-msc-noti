import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, badRequest } from "@/lib/api/response";
import { resetPasswordSchema } from "@/lib/validation/schemas";
import { hashPassword, hashToken } from "@/lib/auth/password";
import { assertSameOrigin, ensureRateLimit } from "@/lib/api/handler";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    ensureRateLimit(req, "reset-password", 5, 3600);

    const { token, password } = resetPasswordSchema.parse(await req.json());
    const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw badRequest("Invalid or expired reset token");
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash: await hashPassword(password) } }),
      prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
      prisma.session.deleteMany({ where: { userId: record.userId } }),
    ]);

    return ok({ reset: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
