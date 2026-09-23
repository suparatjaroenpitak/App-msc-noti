import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { updateAlertSchema } from "@/lib/validation/schemas";

async function getOwnedAlert(id: string, userId: string) {
  const alert = await prisma.alertRule.findUnique({ where: { id }, include: { asset: true } });
  if (!alert || alert.userId !== userId) throw notFound("Alert");
  return alert;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const alert = await getOwnedAlert(id, user.id);
    return ok({ alert });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { id } = await params;
    await getOwnedAlert(id, user.id);

    const input = updateAlertSchema.parse(await req.json());

    if (input.soundId) {
      const sound = await prisma.notificationSound.findUnique({ where: { id: input.soundId } });
      if (!sound || sound.userId !== user.id) throw notFound("Sound");
    }

    const alert = await prisma.alertRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.condition !== undefined ? { condition: input.condition } : {}),
        ...(input.targetPrice !== undefined ? { targetPrice: input.targetPrice } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...(input.oneTime !== undefined ? { oneTime: input.oneTime } : {}),
        ...(input.cooldownMinutes !== undefined ? { cooldownMinutes: input.cooldownMinutes } : {}),
        ...(input.notificationMessage !== undefined ? { notificationMessage: input.notificationMessage ?? null } : {}),
        ...(input.soundId !== undefined ? { soundId: input.soundId ?? null } : {}),
      },
      include: { asset: { select: { symbol: true, name: true, currency: true } } },
    });
    return ok({ alert });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { id } = await params;
    await getOwnedAlert(id, user.id);
    await prisma.alertRule.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
