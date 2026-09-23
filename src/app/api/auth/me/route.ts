import { ok, toErrorResponse, unauthorized } from "@/lib/api/response";
import { requireUser } from "@/lib/api/handler";
import { updateProfileSchema } from "@/lib/validation/schemas";
import { assertSameOrigin } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const sessionUser = await requireUser(req);
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true, name: true, email: true, image: true, createdAt: true },
    });
    if (!user) throw unauthorized();
    return ok({ user });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    assertSameOrigin(req);
    const { id } = await requireUser(req);
    const { name } = updateProfileSchema.parse(await req.json());
    const user = await prisma.user.update({
      where: { id },
      data: { name },
      select: { id: true, name: true, email: true, image: true },
    });
    return ok({ user });
  } catch (err) {
    return toErrorResponse(err);
  }
}
