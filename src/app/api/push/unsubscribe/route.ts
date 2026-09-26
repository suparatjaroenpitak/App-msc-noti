import { requireUser } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { unsubscribeSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const { endpoint } = unsubscribeSchema.parse(await req.json());

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: user.id },
    });
    return ok({ unsubscribed: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
