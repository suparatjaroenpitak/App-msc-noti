"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Input, Label, Select, Switch, Badge } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

type AiSettings = {
  id: string;
  enabled: boolean;
  analyzeOnTrigger: boolean;
  suggestOnCreate: boolean;
  baseUrl: string; // masked on read
  model: string;
  timeoutSeconds: number;
  temperature: number;
};

export default function AiSettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("llama3.1:8b");
  const [models, setModels] = useState<string[]>([]);
  const [timeoutSeconds, setTimeoutSeconds] = useState(60);
  const [temperature, setT] = useState(0.2);
  const [enabled, setEnabled] = useState(false);
  const [analyzeOnTrigger, setAnalyzeOnTrigger] = useState(false);
  const [suggestOnCreate, setSuggestOnCreate] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    apiFetch<{ settings: AiSettings | null }>("/api/ai/settings")
      .then((d) => {
        setSettings(d.settings);
        if (d.settings) {
          setBaseUrl(d.settings.baseUrl);
          setModel(d.settings.model);
          setTimeoutSeconds(d.settings.timeoutSeconds);
          setT(d.settings.temperature);
          setEnabled(d.settings.enabled);
          setAnalyzeOnTrigger(d.settings.analyzeOnTrigger);
          setSuggestOnCreate(d.settings.suggestOnCreate);
        }
      })
      .catch(() => undefined);
  }, []);

  const testConnection = useCallback(async () => {
    if (!baseUrl.trim() || baseUrl.includes("…")) {
      toast.push("error", "กรุณาใส่ tunnel URL ใหม่ (เช่น https://xxxx.trycloudflare.com)");
      return;
    }
    setTesting(true);
    setConnected(null);
    try {
      const r = await apiFetch<{ connected: boolean; models: string[] }>("/api/ai/status", {
        method: "POST",
        body: JSON.stringify({ baseUrl: baseUrl.trim() }),
      });
      setModels(r.models);
      if (r.models.length > 0 && !r.models.includes(model)) setModel(r.models[0]!);
      setConnected(true);
      toast.push("success", `เชื่อมต่อ Ollama สำเร็จ — พบ ${r.models.length} โมเดล`);
    } catch (e) {
      setConnected(false);
      toast.push("error", e instanceof ApiClientError ? e.message : "เชื่อมต่อไม่สำเร็จ");
    } finally {
      setTesting(false);
    }
  }, [baseUrl, model, toast]);

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        model,
        timeoutSeconds,
        temperature,
        enabled,
        analyzeOnTrigger,
        suggestOnCreate,
      };
      if (baseUrl.trim() && !baseUrl.includes("…")) body.baseUrl = baseUrl.trim();
      const d = await apiFetch<{ settings: AiSettings }>("/api/ai/settings", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSettings(d.settings);
      toast.push("success", "บันทึกการตั้งค่า AI แล้ว");
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">AI (Ollama on Colab)</h1>

      <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
        <p className="font-semibold">วิธีเชื่อมต่อ (สรุป)</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs leading-relaxed">
          <li>เปิด notebook <code>colab/ollama_server.ipynb</code> ใน Google Colab แล้วรันทุก cell</li>
          <li>คัดลอก URL <code>https://xxxx.trycloudflare.com</code> จาก cell สุดท้าย</li>
          <li>วางในช่อง Base URL ด้านล่าง → ทดสอบ → เลือกโมเดล → บันทึก</li>
          <li>URL จาก tunnel จะเปลี่ยนเมื่อรัน notebook ใหม่ ต้องมาอัปเดตที่นี่</li>
        </ol>
      </div>

      <Card>
        <CardHeader title="การเชื่อมต่อ Ollama" />
        <CardBody className="space-y-4">
          <div>
            <Label htmlFor="baseUrl">Ollama Base URL (tunnel)</Label>
            <Input
              id="baseUrl"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://xxxx.trycloudflare.com"
              autoComplete="off"
            />
            {settings && settings.baseUrl.includes("…") ? (
              <p className="mt-1 text-xs text-neutral-400">ค่าปัจจุบัน (ปกปิด): {settings.baseUrl}</p>
            ) : null}
            <p className="mt-1 text-xs text-neutral-400">
              เก็บใน DB ของคุณเอง · ระบบอนุญาตเฉพาะโดเมน tunnel ที่ปลอดภัย (trycloudflare / ngrok / localtunnel) หรือ localhost ตอน dev
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={testConnection} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              ทดสอบการเชื่อมต่อ
            </Button>
            {connected === true ? <Badge tone="green"><CheckCircle2 className="mr-1 inline h-3 w-3" />สำเร็จ</Badge> : null}
            {connected === false ? <Badge tone="red"><XCircle className="mr-1 inline h-3 w-3" />ล้มเหลว</Badge> : null}
          </div>

          <div>
            <Label htmlFor="model">โมเดล</Label>
            {models.length > 0 ? (
              <Select id="model" value={model} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            ) : (
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="llama3.1:8b" />
            )}
            <p className="mt-1 text-xs text-neutral-400">แนะนำ llama3.1:8b / qwen2.5:7b (เบาพอสำหรับ Colab T4)</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="timeout">Timeout (วินาที)</Label>
              <Input id="timeout" type="number" min="15" max="300" value={timeoutSeconds}
                onChange={(e) => setTimeoutSeconds(Number(e.target.value))} />
            </div>
            <div>
              <Label htmlFor="temp">Temperature (0–1)</Label>
              <Input id="temp" type="number" min="0" max="1" step="0.1" value={temperature}
                onChange={(e) => setT(Number(e.target.value))} />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="พฤติกรรม AI" />
        <CardBody className="space-y-4">
          {([
            ["enabled", "เปิดใช้ AI", enabled, setEnabled],
            ["suggestOnCreate", "ให้ AI แนะนำราคาเข้าตอนสร้าง Alert", suggestOnCreate, setSuggestOnCreate],
            ["analyzeOnTrigger", "วิเคราะห์อัตโนมัติเมื่อ Alert trigger (แนบใน push)", analyzeOnTrigger, setAnalyzeOnTrigger],
          ] as const).map(([key, label, val, setter]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm">{label}</span>
              <Switch checked={val} onChange={(v) => setter(v)} label={label} />
            </div>
          ))}
          <p className="text-xs text-neutral-400">
            ⚠️ ผลวิเคราะห์จาก AI มีความไม่แน่นอน ใช้เป็นข้อมูลประกอบเท่านั้น — <strong>ไม่ใช่คำแนะนำการลงทุน</strong>
          </p>
        </CardBody>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า AI"}</Button>
      </div>

      <p className="flex items-center gap-2 text-xs text-neutral-400">
        <Bot className="h-3.5 w-3.5" /> โมเดลรันบน Ollama ส่วนตัวของคุณใน Colab — ข้อมูลราคาที่ส่งไปมีเพียง symbol และตัวเลขราคา
      </p>
    </div>
  );
}
