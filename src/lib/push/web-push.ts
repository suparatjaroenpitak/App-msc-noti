import webpush from "web-push";
import { env } from "@/lib/env";

let configured = false;

export function configurePush(): boolean {
  if (!env.vapid.configured) return false;
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey!, env.vapid.privateKey!);
  configured = true;
  return true;
}

export function isPushConfigured(): boolean {
  return env.vapid.configured;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  alertEventId?: string;
  symbol?: string;
  soundUrl?: string | null;
  /** Payload may exceed some gateways' limits; keep it lean. */
}

export type PushResult = { ok: true } | { ok: false; permanent: boolean; errorMessage: string };

/** Send one push. `permanent` failure means the subscription is dead (404/410) and should be removed. */
export async function sendPush(subscription: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<PushResult> {
  if (!configured && !configurePush()) {
    return { ok: false, permanent: false, errorMessage: "VAPID keys are not configured" };
  }
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: 3600, urgency: "high" },
    );
    return { ok: true };
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode;
    const message = err instanceof Error ? err.message : String(err);
    const permanent = statusCode === 404 || statusCode === 410;
    return { ok: false, permanent, errorMessage: `Push failed${statusCode ? ` (${statusCode})` : ""}: ${message}` };
  }
}
