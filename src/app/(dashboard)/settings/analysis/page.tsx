"use client";

import { useEffect, useState } from "react";
import { Activity, Info } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Input, Label, Switch, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

type Settings = {
  enabled: boolean;
  suggestOnCreate: boolean;
  analyzeOnTrigger: boolean;
  lookbackMinutes: number;
  minSamples: number;
};

export default function AnalysisSettingsPage() {
  const toast = useToast();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<{ settings: Settings }>("/api/analysis/settings")
      .then((d) => setS(d.settings))
      .catch(() => undefined);
  }, []);

  const save = async (patch: Partial<Settings>) => {
    setSaving(true);
    try {
      const d = await apiFetch<{ settings: Settings }>("/api/analysis/settings", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setS(d.settings);
      toast.push("success", "บันทึกแล้ว");
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">การวิเคราะห์ในตัว (Built-in Engine)</h1>

      <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
        <p className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> ระบบวิเคราะห์ทำงานอย่างไร</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
          <li>Worker เก็บราคาของหุ้นที่คุณตั้ง Alert ไว้ทุก 1 นาที (ตลาดเปิด) ลงฐานข้อมูลของคุณเอง</li>
          <li>Engine ในตัวคำนวณ SMA(5/20), โมเมนตัม, RSI(14), ความผันผวน และตำแหน่งราคาในกรอบวัน</li>
          <li>ใช้สัญญาณเหล่านั้นแนะนำ <strong>จุดเข้า / stop / target</strong> และ verdict (BUY/WAIT/AVOID)</li>
          <li>ทุกอย่างคำนวณในเซิร์ฟเวอร์ของคุณ — <strong>ไม่ส่งข้อมูลออกไปภายนอก</strong> ไม่ต้องตั้งค่า API ใด ๆ</li>
          <li>ยิ่งเปิด Alert ไว้นาน ข้อมูลยิ่งสะสม ผลวิเคราะห์ยิ่งแม่น (ต้องมีอย่างน้อย 12 จุด)</li>
        </ul>
      </div>

      {s ? (
        <Card>
          <CardHeader title="พฤติกรรม" />
          <CardBody className="space-y-4">
            {([
              ["enabled", "เปิดใช้การวิเคราะห์"],
              ["suggestOnCreate", "แนะนำราคาเข้าตอนสร้าง Alert (ปุ่มวิเคราะห์)"],
              ["analyzeOnTrigger", "แนบสรุปการวิเคราะห์ใน notification เมื่อ Alert trigger"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={s[key]} onChange={(v) => void save({ [key]: v })} label={label} />
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Card><CardBody className="py-8 text-center text-sm text-neutral-400">กำลังโหลด…</CardBody></Card>
      )}

      {s ? (
        <Card>
          <CardHeader title="พารามิเตอร์ Engine" />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="lookback">มองย้อนหลัง (นาที)</Label>
                <Input
                  id="lookback" type="number" min="60" max="4320"
                  value={s.lookbackMinutes}
                  onChange={(e) => setS({ ...s, lookbackMinutes: Number(e.target.value) })}
                  onBlur={() => void save({ lookbackMinutes: s.lookbackMinutes })}
                />
              </div>
              <div>
                <Label htmlFor="minSamples">จำนวนจุดข้อมูลขั้นต่ำ</Label>
                <Input
                  id="minSamples" type="number" min="5" max="120"
                  value={s.minSamples}
                  onChange={(e) => setS({ ...s, minSamples: Number(e.target.value) })}
                  onBlur={() => void save({ minSamples: s.minSamples })}
                />
              </div>
            </div>
            <p className="flex items-center gap-2 text-xs text-neutral-400">
              <Activity className="h-3.5 w-3.5" />
              ผลวิเคราะห์เป็นเพียงข้อมูลประกอบ — <strong>ไม่ใช่คำแนะนำการลงทุน</strong>
              <Badge tone="amber">builtin-v1</Badge>
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
