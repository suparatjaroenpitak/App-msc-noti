"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Search } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Input, Label, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

type AssetOption = { id: string; symbol: string; name: string; type: string };
type SearchResult = { symbol: string; name: string };
type Sound = { id: string; name: string };

type AlertForm = {
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: string;
  oneTime: boolean;
  cooldownMinutes: string;
  notificationMessage: string;
  soundId: string;
};

function CreateAlertForm() {
  const router = useRouter();
  const toast = useToast();
  const search = useSearchParams();
  const prefillSymbol = search.get("symbol")?.toUpperCase() ?? "";
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<AlertForm>({
    defaultValues: { type: "ENTRY", condition: "BELOW_OR_EQUAL", cooldownMinutes: "60", oneTime: false },
  });

  const [asset, setAsset] = useState<AssetOption | null>(null);
  const [query, setQuery] = useState(prefillSymbol);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sounds, setSounds] = useState<Sound[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve prefill symbol to an asset id.
  useEffect(() => {
    if (!prefillSymbol) return;
    (async () => {
      try {
        const data = await apiFetch<{ results: SearchResult[] }>(`/api/assets/search?q=${prefillSymbol}`);
        const exact = data.results.find((r) => r.symbol === prefillSymbol);
        if (exact) setAsset({ id: "", symbol: exact.symbol, name: exact.name, type: "STOCK" });
      } catch { /* noop */ }
    })();
  }, [prefillSymbol]);

  useEffect(() => {
    apiFetch<{ sounds: Sound[] }>("/api/notification-sounds")
      .then((d) => setSounds(d.sounds))
      .catch(() => undefined);
  }, []);

  // Search assets when the asset is not yet chosen.
  useEffect(() => {
    if (asset) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 1) { setResults([]); return; }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch<{ results: SearchResult[] }>(`/api/assets/search?q=${encodeURIComponent(query.trim())}`);
        setResults(data.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, asset]);

  const chooseAsset = useCallback(async (symbol: string, name: string) => {
    try {
      const data = await apiFetch<{ asset: AssetOption }>(`/api/assets/${symbol}`);
      setAsset(data.asset);
      setQuery(symbol);
      setResults([]);
    } catch {
      // Fallback: asset may not exist yet in DB — the API creates it on watchlist add,
      // so here we pass symbol through and let the server resolve/validate.
      setAsset({ id: "", symbol, name, type: "STOCK" });
      setQuery(symbol);
      setResults([]);
    }
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    if (!asset) {
      toast.push("error", "กรุณาเลือกหุ้นก่อน");
      return;
    }
    try {
      await apiFetch("/api/alerts", {
        method: "POST",
        body: JSON.stringify({
          assetId: asset.id,
          name: values.name,
          type: values.type,
          condition: values.condition,
          targetPrice: Number(values.targetPrice),
          oneTime: values.oneTime,
          cooldownMinutes: Number(values.cooldownMinutes || 60),
          notificationMessage: values.notificationMessage || null,
          soundId: values.soundId || null,
          enabled: true,
        }),
      });
      toast.push("success", `สร้าง Alert สำหรับ ${asset.symbol} แล้ว`);
      router.push("/alerts");
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "สร้าง Alert ไม่สำเร็จ");
    }
  });

  const condition = watch("condition");

  return (
    <Card>
      <CardHeader title="สร้าง Price Alert" subtitle="แจ้งเตือนเมื่อราคาถึงเงื่อนไขที่คุณกำหนด" />
      <CardBody>
        <form onSubmit={onSubmit} className="space-y-5" noValidate>
          {/* Asset picker */}
          <div>
            <Label>หุ้น / ETF</Label>
            {asset ? (
              <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 dark:border-emerald-700 dark:bg-emerald-900/30">
                <span className="text-sm font-semibold">{asset.symbol} — {asset.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setAsset(null); setQuery(""); }}>เปลี่ยน</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหา เช่น QQQM, NVDA, VTI" className="pl-9" />
                </div>
                {searching ? <p className="mt-2 text-xs text-neutral-400">กำลังค้นหา…</p> : null}
                {results.length > 0 && !searching ? (
                  <ul className="mt-2 max-h-56 divide-y divide-neutral-100 overflow-y-auto rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-700">
                    {results.map((r) => (
                      <li key={r.symbol}>
                        <button type="button" onClick={() => void chooseAsset(r.symbol, r.name)} className="w-full px-3 py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-800">
                          <p className="text-sm font-semibold">{r.symbol}</p>
                          <p className="text-xs text-neutral-500">{r.name}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>

          <div>
            <Label htmlFor="name">ชื่อ Alert</Label>
            <Input id="name" placeholder="เช่น QQQM ซื้อกระทบยอด" {...register("name", { required: "กรุณาตั้งชื่อ Alert" })} />
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
              <Input id="targetPrice" type="number" step="0.01" min="0.01" placeholder="180.00" {...register("targetPrice", {
                required: "กรุณากรอกราคาเป้าหมาย",
                validate: (v) => Number(v) > 0 || "ราคาต้องมากกว่า 0",
              })} />
              {errors.targetPrice ? <p className="mt-1 text-xs text-red-600">{errors.targetPrice.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="cooldown">Cooldown (นาที) — ช่วงเว้นหลัง trigger</Label>
              <Input id="cooldown" type="number" min="0" max="10080" {...register("cooldownMinutes")} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input id="oneTime" type="checkbox" className="h-4 w-4 rounded border-neutral-300" {...register("oneTime")} />
            <Label htmlFor="oneTime" className="mb-0">One-time (ปิด Alert หลังแจ้งเตือน 1 ครั้ง)</Label>
          </div>

          <div>
            <Label htmlFor="msg">ข้อความแจ้งเตือน (ถ้าต้องการกำหนดเอง)</Label>
            <Textarea id="msg" rows={2} placeholder="เว้นว่าง = ใช้ข้อความมาตรฐานของระบบ" {...register("notificationMessage")} />
          </div>

          <div>
            <Label htmlFor="sound">เสียงแจ้งเตือน</Label>
            <Select id="sound" {...register("soundId")}>
              <option value="">ค่าเริ่มต้นระบบ / เสียงที่ตั้งไว้ใน Preferences</option>
              {sounds.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-neutral-400">เสียงเล่นเมื่อแอปเปิดอยู่ — เบื้องหลังใช้เสียงระบบ (ดูข้อจำกัดในหน้า Sounds)</p>
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <Link href="/alerts"><Button type="button" variant="secondary">ยกเลิก</Button></Link>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "กำลังบันทึก…" : "สร้าง Alert"}</Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}

export default function CreateAlertPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">สร้าง Alert</h1>
      <Suspense fallback={null}>
        <CreateAlertForm />
      </Suspense>
    </div>
  );
}
