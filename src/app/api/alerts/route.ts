import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound, conflict } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { createAlertSchema } from "@/lib/validation/schemas";
import { getCachedQuote } from "@/lib/market-data";

/** GET /api/alerts — all alert rules of the current user with asset info. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const alerts = await prisma.alertRule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        asset: { select: { symbol: true, name: true, currency: true } },
        sound: { select: { name: true } },
        _count: { select: { alertEvents: true } },
      },
    });
    return ok({ alerts });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** POST /api/alerts — create a new alert rule. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const input = createAlertSchema.parse(await req.json());

    const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
    if (!asset) throw notFound("Asset");

    if (input.soundId) {
      const sound = await prisma.notificationSound.findUnique({ where: { id: input.soundId } });
      if (!sound || sound.userId !== user.id) throw notFound("Sound");
    }

    const duplicate = await prisma.alertRule.findUnique({
      where: { userId_assetId_name: { userId: user.id, assetId: asset.id, name: input.name } },
    });
    if (duplicate) throw conflict("You already have an alert with this name for this asset");

    const alert = await prisma.alertRule.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        name: input.name,
        type: input.type,
        condition: input.condition,
        targetPrice: input.targetPrice,
        enabled: input.enabled,
        oneTime: input.oneTime,
        cooldownMinutes: input.cooldownMinutes,
        notificationMessage: input.notificationMessage ?? null,
        soundId: input.soundId ?? null,
      },
      include: { asset: { select: { symbol: true, name: true, currency: true } } },
    });

    return ok({ alert }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
