import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound, badRequest } from "@/lib/api/response";
import { requireUser, assertSameOrigin, ensureUserRateLimit } from "@/lib/api/handler";
import { sendAlertNotification, buildAlertNotification } from "@/lib/notifications/send";
import { getCachedQuote } from "@/lib/market-data";

/**
 * POST /api/alerts/:id/actions { action: "enable" | "disable" | "pause" | "resume" | "duplicate" | "test" }
 * (pause == disable, resume == enable — kept as aliases for UI convenience)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { id } = await params;
    ensureUserRateLimit(user.id, "alert-actions", 30, 60);

    const body = (await req.json()) as { action?: string };
    const action = body?.action;
    if (!action || !["enable", "disable", "pause", "resume", "duplicate", "test"].includes(action)) {
      throw badRequest("Invalid action");
    }

    const alert = await prisma.alertRule.findUnique({ where: { id }, include: { asset: true } });
    if (!alert || alert.userId !== user.id) throw notFound("Alert");

    switch (action) {
      case "enable":
      case "resume": {
        const updated = await prisma.alertRule.update({ where: { id }, data: { enabled: true } });
        return ok({ alert: updated });
      }
      case "disable":
      case "pause": {
        const updated = await prisma.alertRule.update({ where: { id }, data: { enabled: false } });
        return ok({ alert: updated });
      }
      case "duplicate": {
        const copy = await prisma.alertRule.create({
          data: {
            userId: alert.userId,
            assetId: alert.assetId,
            name: `${alert.name} (copy)`,
            type: alert.type,
            condition: alert.condition,
            targetPrice: alert.targetPrice,
            enabled: false,
            oneTime: alert.oneTime,
            cooldownMinutes: alert.cooldownMinutes,
            notificationMessage: alert.notificationMessage,
            soundId: alert.soundId,
          },
        });
        return ok({ alert: copy }, { status: 201 });
      }
      case "test": {
        ensureUserRateLimit(user.id, "alert-test", 10, 3600);
        const quote = await getCachedQuote(alert.asset.symbol);
        const payload = {
          userId: user.id,
          alertRuleId: alert.id,
          alertType: alert.type,
          symbol: alert.asset.symbol,
          assetName: alert.asset.name,
          currentPrice: quote.price,
          targetPrice: alert.targetPrice.toNumber(),
          condition: alert.condition,
          customMessage: alert.notificationMessage,
          triggeredAt: new Date(),
        };
        const { title, body } = buildAlertNotification(payload);
        const result = await sendAlertNotification(payload);
        return ok({ test: true, title, body, ...result });
      }
      default:
        throw badRequest("Invalid action");
    }
  } catch (err) {
    return toErrorResponse(err);
  }
}
