"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Input, Label, Select, Textarea, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type Sound = { id: string; name: string };
type AlertData = {
  id: string;
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: string | number;
  enabled: boolean;
  oneTime: boolean;
  cooldownMinutes: number;
  notificationMessage: string | null;
  soundId: string | null;
  asset: { symbol: string; name: string };
};

type EditForm = {
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: string;
  oneTime: boolean;
  cooldownMinutes: string;
  notificationMessage: string;
  soundId: string;
};

function EditAlertForm({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<AlertData | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EditForm>();

  useEffect(() => {
    (async () => {
      try {
        const [a, s] = await Promise.all([
          apiFetch<{ alert: AlertData }>(`/api/alerts/${id}`),
          apiFetch<{ sounds: Sound[] }>("/api/notification-sounds"),
        ]);
        setData(a.alert);
        setEnabled(a.alert.enabled);
        setSounds(s.sounds);
        reset({
          name: a.alert.name,
          type: a.alert.type,
          condition: a.alert.condition,
          targetPrice: String(a.alert.targetPrice),
          oneTime: a.alert.oneTime,
          cooldownMinutes: String(a.alert.cooldownMinutes),
          notificationMessage: a.alert.notificationMessage ?? "",
          soundId: a.alert.soundId ?? "",
        });
      } catch (e) {
        toast.push("error", e instanceof ApiClientError ? e.message : "โหลด Alert ไม่สำเร็จ");
      }
    })();
  }, [id, reset, toast]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await apiFetch(`/api/alerts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: values.name,
          type: values.type,
          condition: values.condition,
          targetPrice: Number(values.targetPrice),
          oneTime: values.oneTime,
          cooldownMinutes: Number(values.cooldownMinutes || 60),
          notificationMessage: values.notificationMessage || null,
          soundId: values.soundId || null,
        }),
      });
      toast.push("success", "บันทึกการแก้ไขแล้ว");
      router.push("/alerts");
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ");
    }
  });

  const toggleEnabled = async (v: boolean) => {
    setEnabled(v);
    try {
      await apiFetch(`/api/alerts/${id}/actions`, { method: "POST", body: JSON.stringify({ action: v ? "enable" : "disable" }) });
    } catch {
      setEnabled(!v);
      toast.push("error", "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const doDelete = async () => {
    setBusyDelete(true);
    try {
      await apiFetch(`/api/alerts/${id}`, { method: "DELETE" });
      toast.push("success", "ลบ Alert แล้ว");
      router.push("/alerts");
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ลบไม่สำเร็จ");
      setBusyDelete(false);
    }
  };

  if (!data) {
    return (
      <Card><CardBody className="py-10 text-center text-sm text-neutral-400">กำลังโหลด…</CardBody></Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader
          title={`${data.asset.symbol} — แก้ไข Alert`}
          subtitle={data.asset.name}
          action={<Switch checked={enabled} onChange={(v) => void toggleEnabled(v)} label="เปิด/ปิด alert" />}
        />
        <CardBody>
          <form onSubmit={onSubmit} className="space-y-5" noValidate>
            <div>
              <Label htmlFor="name">ชื่อ Alert</Label>
              <Input id="name" {...register("name", { required: "กรุณาตั้งชื่อ Alert" })} />
              {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="type">ประเภท</Label>
                <Select id="type" {...register("type")}>
                  <option value="ENTRY">Entry</option>
                  <option value="EXIT">Exit</option>
                  <option value="CUSTOM">Custom</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="condition">เงื่อนไข</Label>
                <Select id="condition" {...register("condition")}>
                  <option value="ABOVE_OR_EQUAL">ราคา ≥ เป้าหมาย</option>
                  <option value="BELOW_OR_EQUAL">ราคา ≤ เป้าหมาย</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="targetPrice">ราคาเป้าหมาย (USD)</Label>
                <Input id="targetPrice" type="number" step="0.01" min="0.01" {...register("targetPrice", {
                  required: "กรุณากรอกราคาเป้าหมาย",
                  validate: (v) => Number(v) > 0 || "ราคาต้องมากกว่า 0",
                })} />
                {errors.targetPrice ? <p className="mt-1 text-xs text-red-600">{errors.targetPrice.message}</p> : null}
              </div>
              <div>
                <Label htmlFor="cooldown">Cooldown (นาที)</Label>
                <Input id="cooldown" type="number" min="0" max="10080" {...register("cooldownMinutes")} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input id="oneTime" type="checkbox" className="h-4 w-4 rounded border-neutral-300" {...register("oneTime")} />
              <Label htmlFor="oneTime" className="mb-0">One-time (ปิด Alert หลังแจ้งเตือน 1 ครั้ง)</Label>
            </div>
            <div>
              <Label htmlFor="msg">ข้อความแจ้งเตือน (ถ้าต้องการกำหนดเอง)</Label>
              <Textarea id="msg" rows={2} {...register("notificationMessage")} />
            </div>
            <div>
              <Label htmlFor="sound">เสียงแจ้งเตือน</Label>
              <Select id="sound" {...register("soundId")}>
                <option value="">ค่าเริ่มต้นระบบ / เสียงที่ตั้งไว้ใน Preferences</option>
                {sounds.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div className="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-800">
              <Button type="button" variant="danger" onClick={() => setConfirmDelete(true)}>ลบ Alert</Button>
              <div className="flex gap-3">
                <Link href="/alerts"><Button type="button" variant="secondary">ยกเลิก</Button></Link>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "กำลังบันทึก…" : "บันทึก"}</Button>
              </div>
            </div>
          </form>
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        title="ลบ Alert นี้?"
        description="ประวัติการแจ้งเตือนที่เกี่ยวข้องจะถูกลบไปด้วย"
        destructive
        busy={busyDelete}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </>
  );
}

export default function EditAlertPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/alerts" className="text-sm text-neutral-500 hover:underline">← กลับไป Alerts</Link>
      <h1 className="text-2xl font-bold">แก้ไข Alert</h1>
      {id ? (
        <Suspense fallback={null}>
          <EditAlertForm id={id} />
        </Suspense>
      ) : null}
    </div>
  );
}
