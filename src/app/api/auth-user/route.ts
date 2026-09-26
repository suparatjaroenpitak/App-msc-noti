import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";

/** GET /api/auth-user — info about the instance's single implicit user (read-only). */
export async function GET(req: Request) {
  try {
    const { id } = await requireUser(req);
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return ok({ user });
  } catch (err) {
    return toErrorResponse(err);
  }
}
