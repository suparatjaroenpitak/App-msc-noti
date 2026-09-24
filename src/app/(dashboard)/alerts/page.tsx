"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing, Copy, Pencil, Plus, Trash2, Volume2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, Button, Badge, Skeleton, EmptyState, Switch, ConfirmDialog } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatPrice, timeAgo } from "@/lib/utils";

type AlertRow = {
  id: string;
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: string | number;
  enabled: boolean;
  oneTime: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  sound?: { name: string } | null;
  asset: { symbol: string; name: string };
  _count?: { alertEvents: number };
};

export default function AlertsPage() {
  const toast = useToast();
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AlertRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ alerts: AlertRow[] }>("/api/alerts");
      setAlerts(data.alerts);
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "โหลด Alerts ไม่สำเร็จ");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "enable" | "disable" | "duplicate" | "test") => {
    try {
      const r = await apiFetch<{ test?: boolean; sent?: number; failed?: number; reason?: string }>(
        `/api/alerts/${id}/actions`,
        { method: "POST", body: JSON.stringify({ action }) },
      );
      if (action === "duplicate") toast.push("success", "คัดลอก Alert แล้ว (เริ่มต้นเป็นสถานะปิด)");
      if (action === "test") {
        if (r.reason) {
          toast.push("error", `ยังไม่ได้ส่ง: ${r.reason}`);
        } else if ((r.sent ?? 0) > 0) {
          toast.push("success", `ส่ง notification ทดสอบแล้ว ${r.sent} เครื่อง${r.failed ? ` (ล้มเหลว ${r.failed})` : ""}`);
        } else {
          toast.push("error", "ส่งไม่สำเร็จทุกเครื่อง — ดูสาเหตุใน Delivery Logs (หน้า Notifications)");
        }
      }
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ทำรายการไม่สำเร็จ");
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await apiFetch(`/api/alerts/${confirmDelete.id}`, { method: "DELETE" });
      toast.push("success", "ลบ Alert แล้ว");
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Price Alerts</h1>
        <Link href="/alerts/create">
          <Button><Plus className="h-4 w-4" /> สร้าง Alert</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title="Alert ทั้งหมด" subtitle="ตั้งเงื่อนไขราคา แล้วรับการแจ้งเตือนเมื่อราคาถึงเป้า" />
        {alerts === null ? (
          <div className="space-y-3 p-5">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : alerts.length === 0 ? (
          <EmptyState
            icon={<BellRing className="h-10 w-10" />}
            title="ยังไม่มี Alert"
            description='เช่น "แจ้งเตือนเมื่อ QQQM ราคา ≤ 180 USD" หรือ "NVDA ≥ 150 USD"'
            action={<Link href="/alerts/create"><Button><Plus className="h-4 w-4" /> สร้าง Alert แรก</Button></Link>}
          />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {alerts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5">
                <Switch
                  checked={a.enabled}
                  label={`เปิด/ปิด ${a.name}`}
                  onChange={(v) => void act(a.id, v ? "enable" : "disable")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold">{a.asset.symbol} · {a.name}</p>
                    <Badge tone={a.type === "ENTRY" ? "green" : a.type === "EXIT" ? "red" : "gray"}>{a.type}</Badge>
                    {a.oneTime ? <Badge tone="amber">One-time</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    แจ้งเตือนเมื่อราคา{a.condition === "ABOVE_OR_EQUAL" ? " ≥ " : " ≤ "}{formatPrice(Number(a.targetPrice))}
                    {" · "}cooldown {a.cooldownMinutes} นาที
                    {a.sound ? <> · <Volume2 className="inline h-3 w-3" /> {a.sound.name}</> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {a.lastTriggeredAt ? `trigger ล่าสุด ${timeAgo(a.lastTriggeredAt)}` : "ยังไม่เคย trigger"}
                    {a._count ? ` · ${a._count.alertEvents} events` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => void act(a.id, "test")} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800" title="ทดสอบ">
                    <BellRing className="h-4 w-4" />
                  </button>
                  <button onClick={() => void act(a.id, "duplicate")} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800" title="คัดลอก">
                    <Copy className="h-4 w-4" />
                  </button>
                  <Link href={`/alerts/${a.id}/edit`} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800" title="แก้ไข">
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <button onClick={() => setConfirmDelete(a)} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950" title="ลบ">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`ลบ Alert "${confirmDelete?.name ?? ""}"?`}
        description="ประวัติการแจ้งเตือนที่เกี่ยวข้องจะถูกลบไปด้วย"
        destructive
        busy={busy}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
