"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Send, Smartphone } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Badge, Skeleton, EmptyState, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePush } from "@/hooks/use-push";
import { formatPrice, timeAgo } from "@/lib/utils";

type EventRow = {
  id: string; symbol: string; currentPrice: string; targetPrice: string;
  triggeredAt: string; status: "TRIGGERED" | "FAILED";
};

type LogRow = {
  id: string; title: string; body: string; status: "SENT" | "FAILED";
  errorMessage: string | null; sentAt: string;
};

type Device = { id: string; endpoint: string; deviceName: string | null; lastUsedAt: string };

export default function NotificationsPage() {
  const toast = useToast();
  const push = usePush();
  const [tab, setTab] = useState<"history" | "logs" | "devices">("history");
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, l, s] = await Promise.all([
        apiFetch<{ events: EventRow[] }>("/api/alert-history"),
        apiFetch<{ logs: LogRow[] }>("/api/notification-history"),
        apiFetch<{ devices: Device[] }>("/api/push/status"),
      ]);
      setEvents(e.events);
      setLogs(l.logs);
      setDevices(s.devices);
    } catch (e2) {
      toast.push("error", e2 instanceof ApiClientError ? e2.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load, push.subscribed]);

  const sendTest = async () => {
    setTesting(true);
    try {
      const r = await push.sendTest();
      if (r.reason) {
        // Nothing was attempted — tell the user WHY instead of a fake success.
        toast.push("error", `ยังไม่ได้ส่ง: ${r.reason}`);
      } else if (r.sent > 0 && r.failed === 0) {
        toast.push("success", `ส่งแล้ว ${r.sent} เครื่อง`);
      } else if (r.sent > 0) {
        toast.push("info", `ส่งสำเร็จ ${r.sent} เครื่อง · ล้มเหลว ${r.failed} เครื่อง (ดูรายละเอียดใน Delivery Logs)`);
      } else {
        toast.push("error", "ส่งไม่สำเร็จทุกเครื่อง — ดูสาเหตุในแท็บ Delivery Logs");
      }
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ส่งไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  };

  const togglePush = async (v: boolean) => {
    try {
      const r = v ? await push.enable() : await push.disable();
      toast.push(r.ok ? "success" : "error", r.message);
    } catch (e) {
      // Surface the real error — previously this failed silently on mobile.
      toast.push("error", e instanceof ApiClientError ? e.message : "เปิด/ปิด push ไม่สำเร็จ — ลองใหม่อีกครั้ง");
      await push.refresh();
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Notifications</h1>

      {/* Push status card */}
      <Card>
        <CardHeader
          title="Push Notification"
          subtitle={push.supported ? "รับการแจ้งเตือนบนอุปกรณ์นี้" : "เบราว์เซอร์นี้ไม่รองรับ Push (iOS ต้องติดตั้งเป็น PWA ก่อน — ดูหน้า Install)"}
          action={<Switch checked={push.subscribed} onChange={(v) => void togglePush(v)} disabled={!push.supported} label="เปิด push" />}
        />
        <CardBody className="flex flex-wrap items-center gap-3">
          <Badge tone={push.permission === "granted" ? "green" : push.permission === "denied" ? "red" : "amber"}>
            permission: {push.permission}
          </Badge>
          <Button size="sm" variant="secondary" onClick={sendTest} disabled={testing}>
            <Send className="h-3.5 w-3.5" /> {testing ? "กำลังส่ง…" : "ส่งข้อความทดสอบ"}
          </Button>
        </CardBody>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
        {([["history", "Alert History"], ["logs", "Delivery Logs"], ["devices", "อุปกรณ์"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === key ? "bg-white shadow dark:bg-neutral-900" : "text-neutral-500"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <Card>
          {events === null ? (
            <CardBody className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</CardBody>
          ) : events.length === 0 ? (
            <EmptyState icon={<BellRing className="h-10 w-10" />} title="ยังไม่มีประวัติการแจ้งเตือน" description="เมื่อ Alert trigger เหตุการณ์จะแสดงที่นี่" />
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{ev.symbol}</p>
                    <p className="text-xs text-neutral-500">
                      ราคา {formatPrice(Number(ev.currentPrice))} · เป้า {formatPrice(Number(ev.targetPrice))} · {timeAgo(ev.triggeredAt)}
                    </p>
                  </div>
                  <Badge tone={ev.status === "TRIGGERED" ? "green" : "red"}>{ev.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "logs" ? (
        <Card>
          {logs === null ? (
            <CardBody className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</CardBody>
          ) : logs.length === 0 ? (
            <EmptyState title="ยังไม่มี Delivery Log" />
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {logs.map((l) => (
                <div key={l.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-semibold">{l.title}</p>
                    <Badge tone={l.status === "SENT" ? "green" : "red"}>{l.status}</Badge>
                  </div>
                  <p className="mt-0.5 whitespace-pre-line text-xs text-neutral-500">{l.body}</p>
                  {l.errorMessage ? <p className="mt-1 text-xs text-red-500">{l.errorMessage}</p> : null}
                  <p className="mt-1 text-xs text-neutral-400">{timeAgo(l.sentAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}

      {tab === "devices" ? (
        <Card>
          {devices === null ? (
            <CardBody className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</CardBody>
          ) : devices.length === 0 ? (
            <EmptyState icon={<Smartphone className="h-10 w-10" />} title="ยังไม่มีอุปกรณ์ที่สมัคร push" description="เปิดสวิตช์ด้านบนเพื่อสมัครอุปกรณ์นี้" />
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{d.deviceName ?? "อุปกรณ์"}</p>
                    <p className="truncate text-xs text-neutral-400">{d.endpoint}</p>
                  </div>
                  <span className="text-xs text-neutral-400">{timeAgo(d.lastUsedAt)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
