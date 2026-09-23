import { prisma } from "@/lib/db/prisma";
import { sendPush } from "@/lib/push/web-push";
import type { AlertType } from "@/types/enums";

export interface SendAlertNotificationInput {
  userId: string;
  alertRuleId: string;
  alertEventId?: string;
  alertType: AlertType;
  symbol: string;
  assetName: string;
  currentPrice: number;
  targetPrice: number;
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  customMessage?: string | null;
  triggeredAt: Date;
}

const CONDITION_TEXT: Record<SendAlertNotificationInput["condition"], string> = {
  ABOVE_OR_EQUAL: "ราคาขึ้นถึงเงื่อนไขที่คุณตั้งไว้แล้ว",
  BELOW_OR_EQUAL: "ราคาลงถึงเงื่อนไขที่คุณตั้งไว้แล้ว",
};

export function buildAlertNotification(input: SendAlertNotificationInput): { title: string; body: string } {
  const typeLabel = input.alertType === "ENTRY" ? "Entry" : input.alertType === "EXIT" ? "Exit" : "Custom";
  const title = `${input.symbol} ${typeLabel} Alert`;
  const body =
    input.customMessage?.trim() ||
    `ราคาปัจจุบัน: $${input.currentPrice.toFixed(2)} · เป้าหมาย: $${input.targetPrice.toFixed(2)}\n${CONDITION_TEXT[input.condition]}`;
  return { title, body };
}

/**
 * Send an alert push to every subscription of the user, honoring notification
 * preferences (push/entry/exit/custom) and the per-type/default sound.
 * Writes one NotificationLog per subscription attempt.
 */
export async function sendAlertNotification(input: SendAlertNotificationInput): Promise<{ sent: number; failed: number }> {
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId: input.userId } });
  if (!prefs || !prefs.pushEnabled) return { sent: 0, failed: 0 };

  const typeEnabled =
    (input.alertType === "ENTRY" && prefs.entryEnabled) ||
    (input.alertType === "EXIT" && prefs.exitEnabled) ||
    (input.alertType === "CUSTOM" && prefs.customEnabled);
  if (!typeEnabled) return { sent: 0, failed: 0 };

  // Resolve sound: alert-specific → preference default → null (system sound fallback)
  const rule = await prisma.alertRule.findUnique({ where: { id: input.alertRuleId }, select: { soundId: true } });
  let soundUrl: string | null = null;
  const soundId = rule?.soundId ?? prefs.defaultSoundId;
  if (soundId) {
    const sound = await prisma.notificationSound.findUnique({ where: { id: soundId }, select: { fileUrl: true } });
    soundUrl = sound?.fileUrl ?? null;
  }

  const { title, body } = buildAlertNotification(input);
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: input.userId } });

  let sent = 0;
  let failed = 0;
  const deadSubscriptionIds: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      const result = await sendPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        {
          title,
          body,
          tag: `alert-${input.alertRuleId}`,
          url: `/assets/${input.symbol}`,
          alertEventId: input.alertEventId,
          symbol: input.symbol,
          soundUrl,
        },
      );
      if (result.ok) {
        sent += 1;
      } else {
        failed += 1;
        if (result.permanent) deadSubscriptionIds.push(sub.id);
      }
      await prisma.notificationLog.create({
        data: {
          userId: input.userId,
          alertEventId: input.alertEventId ?? null,
          pushSubscriptionId: sub.id,
          title,
          body,
          status: result.ok ? "SENT" : "FAILED",
          errorMessage: result.ok ? null : result.errorMessage.slice(0, 500),
        },
      });
    }),
  );

  // Remove dead subscriptions (endpoint gone / gone).
  if (deadSubscriptionIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadSubscriptionIds } } });
  }

  return { sent, failed };
}

/** Send an ad-hoc test notification (no AlertEvent). */
export async function sendTestNotification(userId: string, deviceName?: string): Promise<{ sent: number; failed: number }> {
  const prefs = await prisma.notificationPreference.findUnique({ where: { userId } });
  const { title, body } = {
    title: "Stock Alert — Test 🔔",
    body: `นี่คือ notification ทดสอบ${deviceName ? ` สำหรับ ${deviceName}` : ""} — ระบบพร้อมใช้งาน`,
  };
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;
  const deadSubscriptionIds: string[] = [];

  for (const sub of subscriptions) {
    const result = await sendPush(
      { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
      { title, body, tag: "test", url: "/dashboard" },
    );
    if (result.ok) sent += 1;
    else {
      failed += 1;
      if (result.permanent) deadSubscriptionIds.push(sub.id);
    }
    await prisma.notificationLog.create({
      data: {
        userId,
        pushSubscriptionId: sub.id,
        title,
        body,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.ok ? null : result.errorMessage.slice(0, 500),
      },
    });
  }
  if (deadSubscriptionIds.length > 0) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: deadSubscriptionIds } } });
  }
  return { sent, failed };
}
