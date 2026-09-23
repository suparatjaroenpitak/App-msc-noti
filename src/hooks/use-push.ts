"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

export type PushStatus = {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  subscribed: boolean;
  vapidPublicKey: string | null;
  loading: boolean;
};

export function usePush() {
  const [status, setStatus] = useState<PushStatus>({
    supported: false,
    permission: "unsupported",
    subscribed: false,
    vapidPublicKey: null,
    loading: true,
  });

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    if (!supported) {
      setStatus({ supported: false, permission: "unsupported", subscribed: false, vapidPublicKey: null, loading: false });
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const existing = reg ? await reg.pushManager.getSubscription() : null;
      const data = await apiFetch<{ vapidPublicKey: string | null; devices: unknown[] }>("/api/push/status");
      setStatus({
        supported: true,
        permission: Notification.permission,
        subscribed: Boolean(existing),
        vapidPublicKey: data.vapidPublicKey,
        loading: false,
      });
    } catch {
      setStatus((s) => ({ ...s, loading: false }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (typeof window === "undefined") return { ok: false, message: "Not in browser" };
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return { ok: false, message: "เบราว์เซอร์นี้ไม่รองรับ Push Notification" };
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, message: "ยังไม่ได้รับอนุญาตแสดงการแจ้งเตือน" };
    }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    const { vapidPublicKey } = await apiFetch<{ vapidPublicKey: string | null }>("/api/push/status");
    if (!vapidPublicKey) return { ok: false, message: "เซิร์ฟเวอร์ยังไม่ได้ตั้งค่า VAPID keys" };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
      return { ok: false, message: "Subscription ไม่สมบูรณ์" };
    }
    await apiFetch("/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        deviceName: /iPhone|iPad|Android Mobile/i.test(navigator.userAgent) ? navigator.platform || "Mobile" : "Desktop",
        userAgent: navigator.userAgent,
      }),
    });
    await refresh();
    return { ok: true, message: "เปิดการแจ้งเตือนเรียบร้อยแล้ว" };
  }, [refresh]);

  const disable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      const endpoint = sub.endpoint;
      await sub.unsubscribe().catch(() => undefined);
      await apiFetch("/api/push/unsubscribe", { method: "POST", body: JSON.stringify({ endpoint }) });
    }
    await refresh();
    return { ok: true, message: "ปิดการแจ้งเตือนอุปกรณ์นี้แล้ว" };
  }, [refresh]);

  const sendTest = useCallback(async () => {
    return apiFetch<{ sent: number; failed: number }>("/api/push/test", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }, []);

  return { ...status, refresh, enable, disable, sendTest };
}
