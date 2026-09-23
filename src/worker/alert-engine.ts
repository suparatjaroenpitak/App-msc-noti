import { prisma } from "@/lib/db/prisma";
import { pollActiveSymbols } from "./market-poller";
import { sendAlertNotification } from "@/lib/notifications/send";
import type { AlertCondition } from "@prisma/client";

export interface PollCycleResult {
  symbolsPolled: number;
  rulesEvaluated: number;
  alertsTriggered: number;
  notificationsSent: number;
  notificationsFailed: number;
}

function conditionMet(condition: AlertCondition, price: number, target: number): boolean {
  if (condition === "ABOVE_OR_EQUAL") return price >= target;
  return price <= target; // BELOW_OR_EQUAL
}

/**
 * One full poll cycle. Designed to be called every POLLING_INTERVAL_SECONDS by
 * worker/index.ts (long-running) or POST /api/cron/run-poll (serverless).
 *
 * Idempotency: before triggering, atomically set lastTriggeredAt with a
 * conditional UPDATE — only one worker can win per cooldown window
 * (the DB row acts as the distributed lock).
 */
export async function runPollCycle(options?: { force?: boolean }): Promise<PollCycleResult> {
  const result: PollCycleResult = {
    symbolsPolled: 0,
    rulesEvaluated: 0,
    alertsTriggered: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
  };

  const quotes = await pollActiveSymbols(options);
  result.symbolsPolled = quotes.size;
  if (quotes.size === 0) return result;

  const rules = await prisma.alertRule.findMany({
    where: { enabled: true, asset: { symbol: { in: [...quotes.keys()] } } },
    include: { asset: true },
  });
  result.rulesEvaluated = rules.length;

  const now = Date.now();

  for (const rule of rules) {
    const price = quotes.get(rule.asset.symbol);
    if (price === undefined) continue;
    const target = rule.targetPrice.toNumber();

    if (!conditionMet(rule.condition, price, target)) continue;

    // Cooldown check (cheap pre-filter; the conditional update below is the real lock).
    if (rule.lastTriggeredAt && now - rule.lastTriggeredAt.getTime() < rule.cooldownMinutes * 60_000) continue;

    // Idempotency lock: conditional update wins only if still outside cooldown.
    const cooldownWindowStart = new Date(now - rule.cooldownMinutes * 60_000);
    const claimed = await prisma.alertRule.updateMany({
      where: {
        id: rule.id,
        OR: [{ lastTriggeredAt: null }, { lastTriggeredAt: { lte: cooldownWindowStart } }],
      },
      data: { lastTriggeredAt: new Date(now) },
    });
    if (claimed.count === 0) continue; // another worker already claimed it
    result.alertsTriggered += 1;

    try {
      // 1) Create the event + 2) send pushes + 3) one-time deactivation, atomically enough:
      const alertEvent = await prisma.alertEvent.create({
        data: {
          alertRuleId: rule.id,
          userId: rule.userId,
          symbol: rule.asset.symbol,
          currentPrice: price,
          targetPrice: target,
          status: "TRIGGERED",
          metadata: { condition: rule.condition, type: rule.type },
        },
      });

      // Optional AI analysis (user's own Ollama on Colab) — runs BEFORE the push
      // so the AI's summary/next-entry suggestion rides along in the notification.
      // AI errors must never break the alert pipeline.
      let aiSummary: string | null = null;
      const aiSettings = await prisma.aiSettings.findUnique({ where: { userId: rule.userId } });
      if (aiSettings?.enabled && aiSettings.analyzeOnTrigger) {
        try {
          const { analyzeTrigger } = await import("@/lib/ai/analysis");
          const ai = await analyzeTrigger({
            userId: rule.userId,
            symbol: rule.asset.symbol,
            assetId: rule.assetId,
            alertRuleId: rule.id,
            alertEventId: alertEvent.id,
            assetName: rule.asset.name,
            assetType: rule.asset.type,
            currentPrice: price,
            targetPrice: target,
            condition: rule.condition,
            currency: rule.asset.currency,
          });
          if (ai.summary) aiSummary = ai.summary;
        } catch (err) {
          console.error(`[worker] AI analysis failed for rule ${rule.id}:`, err instanceof Error ? err.message : err);
        }
      }

      const { sent, failed } = await sendAlertNotification({
        userId: rule.userId,
        alertRuleId: rule.id,
        alertEventId: alertEvent.id,
        alertType: rule.type,
        symbol: rule.asset.symbol,
        assetName: rule.asset.name,
        currentPrice: price,
        targetPrice: target,
        condition: rule.condition,
        customMessage: rule.notificationMessage
          ? `${rule.notificationMessage}${aiSummary ? `\n🤖 AI: ${aiSummary}` : ""}`
          : aiSummary
            ? `🤖 AI: ${aiSummary}`
            : null,
        triggeredAt: new Date(),
      });

      result.notificationsSent += sent;
      result.notificationsFailed += failed;

      if (rule.oneTime) {
        await prisma.alertRule.update({ where: { id: rule.id }, data: { enabled: false } });
      }
    } catch (err) {
      // Log the failure but never crash the loop.
      console.error(`[worker] trigger failed for rule ${rule.id}:`, err instanceof Error ? err.message : err);
      await prisma.alertEvent.create({
        data: {
          alertRuleId: rule.id,
          userId: rule.userId,
          symbol: rule.asset.symbol,
          currentPrice: price,
          targetPrice: target,
          status: "FAILED",
          metadata: { error: err instanceof Error ? err.message : String(err) },
        },
      });
    }
  }

  return result;
}
