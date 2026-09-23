"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from "recharts";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Badge, Skeleton, EmptyState, Button } from "@/components/ui";
import { formatPrice, formatPercent, timeAgo } from "@/lib/utils";

type AssetInfo = { id: string; symbol: string; name: string; exchange: string; type: "STOCK" | "ETF"; currency: string };
type Quote = {
  price: number; change: number; changePercent: number;
  dayHigh: number | null; dayLow: number | null; previousClose: number | null; volume: number | null; currency: string;
};
type AlertRow = {
  id: string; name: string; type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL"; targetPrice: string | number; enabled: boolean; lastTriggeredAt: string | null;
};

export default function AssetDetailPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = (params?.symbol ?? "").toUpperCase();
  const [asset, setAsset] = useState<AssetInfo | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [history, setHistory] = useState<{ time: string; price: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ asset: AssetInfo; quote: Quote }>(`/api/assets/${symbol}`);
      setAsset(data.asset);
      setQuote(data.quote);
      setHistory((h) => [...h.slice(-59), { time: new Date().toLocaleTimeString(), price: data.quote.price }]);
      const a = await apiFetch<{ alerts: AlertRow[] }>("/api/alerts");
      setAlerts(a.alerts.filter((x) => x.asset.symbol === symbol));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, [symbol]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <EmptyState title="เกิดข้อผิดพลาด" description={error} action={<Button variant="secondary" onClick={() => void load()}>ลองอีกครั้ง</Button>} />
      </div>
    );
  }

  const up = (quote?.change ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/watchlist" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Watchlist
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {asset === null ? (
            <Skeleton className="h-9 w-56" />
          ) : (
            <>
              <h1 className="flex items-center gap-2 text-3xl font-bold">
                {asset.symbol} <Badge tone={asset.type === "ETF" ? "blue" : "gray"}>{asset.type}</Badge>
              </h1>
              <p className="mt-1 text-neutral-500">{asset.name} · {asset.exchange}</p>
            </>
          )}
        </div>
        <Link href={`/alerts/create?symbol=${symbol}`}>
          <Button><Plus className="h-4 w-4" /> สร้าง Alert สำหรับ {symbol}</Button>
        </Link>
      </div>

      {/* Quote */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="ราคาปัจจุบัน" value={quote ? formatPrice(quote.price, quote.currency) : "—"} big />
        <Stat label="เปลี่ยนแปลง" value={quote ? `${up ? "+" : ""}${quote.change.toFixed(2)}` : "—"} tone={up ? "up" : "down"} />
        <Stat label="%" value={quote ? formatPercent(quote.changePercent) : "—"} tone={up ? "up" : "down"} />
        <Stat label="Day High" value={quote?.dayHigh != null ? formatPrice(quote.dayHigh, quote.currency) : "—"} />
        <Stat label="Day Low" value={quote?.dayLow != null ? formatPrice(quote.dayLow, quote.currency) : "—"} />
        <Stat label="Prev Close" value={quote?.previousClose != null ? formatPrice(quote.previousClose, quote.currency) : "—"} />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader title="กราฟราคาในเซสชันนี้" subtitle="สุ่มตัวอย่างราคาทุก 60 วินาทีระหว่างเปิดหน้านี้ (ไม่ใช่ข้อมูลย้อนหลัง)" />
        <CardBody>
          {history.length < 2 ? (
            <p className="py-10 text-center text-sm text-neutral-400">กำลังเก็บตัวอย่างราคา…</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number | string) => [formatPrice(Number(v)), "ราคา"]}
                  />
                  <Line type="monotone" dataKey="price" stroke="#059669" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Alerts for this asset */}
      <Card>
        <CardHeader title={`Alerts ของ ${symbol}`} />
        {alerts === null ? (
          <CardBody className="space-y-3">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-12" />)}</CardBody>
        ) : alerts.length === 0 ? (
          <EmptyState icon={<TrendingUp className="h-10 w-10" />} title="ยังไม่มี Alert สำหรับหุ้นนี้" />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {alerts.map((a) => (
              <Link key={a.id} href={`/alerts/${a.id}/edit`} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-neutral-500">
                    {a.condition === "ABOVE_OR_EQUAL" ? "≥" : "≤"} {formatPrice(Number(a.targetPrice))} · {a.type} · {a.enabled ? "เปิด" : "ปิด"}
                  </p>
                </div>
                {a.lastTriggeredAt ? <span className="text-xs text-neutral-400">trigger {timeAgo(a.lastTriggeredAt)}</span> : null}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: "up" | "down" }) {
  return (
    <Card>
      <CardBody className="p-4">
        <p className="text-xs text-neutral-500">{label}</p>
        <p className={`mt-1 font-bold ${big ? "text-2xl" : "text-lg"} ${tone === "up" ? "text-emerald-600" : tone === "down" ? "text-red-500" : ""}`}>
          {value}
        </p>
      </CardBody>
    </Card>
  );
}
