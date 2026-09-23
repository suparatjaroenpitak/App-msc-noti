"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Label, Select, Switch, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { usePush } from "@/hooks/use-push";
import { playNotificationSound } from "@/hooks/use-sound";

type Prefs = {
  pushEnabled: boolean;
  entryEnabled: boolean;
  exitEnabled: boolean;
  customEnabled: boolean;
  defaultSoundId: string | null;
  volume: number;
};

type Sound = { id: string; name: string };

export default function NotificationSettingsPage() {
  const toast = useToast();
  const push = usePush();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        apiFetch<{ preferences: Prefs }>("/api/notification-preferences"),
        apiFetch<{ sounds: Sound[] }>("/api/notification-sounds"),
      ]);
      setPrefs(p.preferences);
      setSounds(s.sounds);
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "โหลดการตั้งค่าไม่สำเร็จ");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: Partial<Prefs>) => {
    setSaving(true);
    try {
      const d = await apiFetch<{ preferences: Prefs }>("/api/notification-preferences", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setPrefs(d.preferences);
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const togglePush = async (v: boolean) => {
    const r = v ? await push.enable() : await push.disable();
    toast.push(r.ok ? "success" : "error", r.message);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">ตั้งค่าการแจ้งเตือน</h1>

      <Card>
        <CardHeader title="Push บนอุปกรณ์นี้" subtitle={push.supported ? undefined : "เบราว์เซอร์ไม่รองรับ — iOS ต้องติดตั้งเป็น PWA ก่อน"} />
        <CardBody className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">รับการแจ้งเตือนบนอุปกรณ์นี้</p>
            <p className="text-xs text-neutral-500">สถานะ: {push.loading ? "…" : push.subscribed ? "สมัครแล้ว" : "ยังไม่สมัคร"}</p>
          </div>
          <Switch checked={push.subscribed} onChange={(v) => void togglePush(v)} disabled={!push.supported} label="push device" />
        </CardBody>
      </Card>

      {prefs ? (
        <Card>
          <CardHeader title="ประเภทการแจ้งเตือน" />
          <CardBody className="space-y-4">
            {([
              ["pushEnabled", "เปิดใช้ Push ทั้งหมด"],
              ["entryEnabled", "แจ้งเตือนประเภท Entry"],
              ["exitEnabled", "แจ้งเตือนประเภท Exit"],
              ["customEnabled", "แจ้งเตือนประเภท Custom"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={prefs[key]} onChange={(v) => void save({ [key]: v })} label={label} />
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Card><CardBody className="py-8 text-center text-sm text-neutral-400">กำลังโหลด…</CardBody></Card>
      )}

      {prefs ? (
        <Card>
          <CardHeader title="เสียงและระดับเสียง" subtitle="เสียงเล่นเมื่อแอปเปิดอยู่ — เบื้องหลังใช้เสียงระบบ (fallback)" />
          <CardBody className="space-y-4">
            <div>
              <Label htmlFor="sound">เสียงเริ่มต้น</Label>
              <Select
                id="sound"
                value={prefs.defaultSoundId ?? ""}
                onChange={(e) => void save({ defaultSoundId: e.target.value || null })}
              >
                <option value="">System sound (ค่าเริ่มต้นของ OS)</option>
                {sounds.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="volume">ระดับเสียง ({Math.round(prefs.volume * 100)}%)</Label>
              <input
                id="volume"
                type="range"
                min="0"
                max="100"
                value={Math.round(prefs.volume * 100)}
                onChange={(e) => setPrefs({ ...prefs, volume: Number(e.target.value) / 100 })}
                onMouseUp={() => void save({ volume: prefs.volume })}
                onTouchEnd={() => void save({ volume: prefs.volume })}
                className="w-full accent-emerald-600"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const s = sounds.find((x) => x.id === prefs.defaultSoundId);
                playNotificationSound(s?.fileUrl ?? null, prefs.volume);
              }}
            >
              ทดสอบเสียง
            </Button>
          </CardBody>
        </Card>
      ) : null}

      <Button onClick={() => void save({})} disabled={saving} variant="ghost" className="hidden">
        save
      </Button>
    </div>
  );
}
