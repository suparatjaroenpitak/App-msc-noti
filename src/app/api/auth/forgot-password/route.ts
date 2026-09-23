import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { forgotPasswordSchema } from "@/lib/validation/schemas";
import { generateToken, hashToken } from "@/lib/auth/password";
import { assertSameOrigin, ensureRateLimit } from "@/lib/api/handler";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    ensureRateLimit(req, "forgot-password", 3, 3600); // 3 per hour per IP

    const { email } = forgotPasswordSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return 200 to avoid account enumeration.
    let devToken: string | undefined;
    if (user) {
      const token = generateToken(32);
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 3600_000), // 1 hour
        },
      });
      // Production: send by email using your mail provider. Dev: return token for testing.
      if (process.env.NODE_ENV !== "production") {
        devToken = token;
      }
    }

    return ok({
      message: "If the email exists, a reset link has been sent.",
      ...(devToken ? { devToken } : {}),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
