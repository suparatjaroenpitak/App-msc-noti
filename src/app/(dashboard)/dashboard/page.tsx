"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Plus, TrendingUp, TrendingDown, LineChart } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Badge, Skeleton, EmptyState, Button } from "@/components/ui";
import { formatPrice, formatPercent, timeAgo } from "@/lib/utils";
import { useSystemStatus } from "@/hooks/use-market-status";
import { usePush } from "@/hooks/use-push";

type WatchItem = {
  id: string;
  symbol: string;
  name: string;
  type: "STOCK" | "ETF";
  alertCount: number;
  quote: { price: number; change: number; changePercent: number; currency: string } | null;
};

type AlertRow = {
  id: string;
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: string | number;
  enabled: boolean;
  lastTriggeredAt: string | null;
  asset: { symbol: string };
};

type EventRow = {
  id: string;
  symbol: string;
  currentPrice: string;
  targetPrice: string;
  triggeredAt: string;
  status: "TRIGGERED" | "FAILED";
};

export default function DashboardPage() {
  const { status } = useSystemStatus();
  const push = usePush();
  const [items, setItems] = useState<WatchItem[] | null>(null);
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [w, a, e] = await Promise.all([
        apiFetch<{ items: WatchItem[] }>("/api/watchlist"),
        apiFetch<{ alerts: AlertRow[] }>("/api/alerts"),
        apiFetch<{ events: EventRow[] }>("/api/alert-history?pageSize=5"),
      ]);
      setItems(w.items);
      setAlerts(a.alerts);
      setEvents(e.events);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "โหลดข้อมูลไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const activeAlerts = alerts?.filter((a) => a.enabled).length ?? 0;
  const watchCount = items?.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button onClick={() => (window.location.href = "/alerts/create")} className="hidden sm:inline-flex">
          <Plus className="h-4 w-4" /> สร้าง Alert
        </Button>
      </div>

      {error ? (
        <Card>
          <CardBody className="text-center text-sm text-red-600">{error}</CardBody>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-xs text-neutral-500">หุ้นใน Watchlist</p>
            {items === null ? <Skeleton className="mt-2 h-7 w-10" /> : <p className="mt-1 text-2xl font-bold">{watchCount}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs text-neutral-500">Active Alerts</p>
            {alerts === null ? <Skeleton className="mt-2 h-7 w-10" /> : <p className="mt-1 text-2xl font-bold">{activeAlerts}</p>}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs text-neutral-500">Market Status</p>
            {status === null ? <Skeleton className="mt-2 h-7 w-24" /> : (
              <div className="mt-1 flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${status.market.state === "OPEN" ? "bg-emerald-500" : "bg-neutral-400"}`} />
                <p className="text-sm font-semibold">{status.market.label}</p>
              </div>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs text-neutral-500">Notifications</p>
            {push.loading ? <Skeleton className="mt-2 h-7 w-24" /> : (
              <div className="mt-1 flex items-center gap-2">
                <Bell className={`h-4 w-4 ${push.subscribed ? "text-emerald-500" : "text-neutral-400"}`} />
                <p className="text-sm font-semibold">{push.subscribed ? "เปิดใช้งาน" : push.supported ? "ยังไม่เปิด" : "ไม่รองรับ"}</p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Watchlist preview */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Watchlist"
            action={<Link href="/watchlist" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">ดูทั้งหมด</Link>}
          />
          {items === null ? (
            <CardBody className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </CardBody>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-10 w-10" />}
              title="ยังไม่มีหุ้นใน Watchlist"
              description="เพิ่มหุ้นหรือ ETF ที่สนใจเพื่อเริ่มติดตามราคา"
              action={<Link href="/watchlist"><Button>ไปที่ Watchlist</Button></Link>}
            />
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {items.slice(0, 6).map((it) => (
                <Link key={it.id} href={`/assets/${it.symbol}`} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{it.symbol} <Badge tone={it.type === "ETF" ? "blue" : "gray"}>{it.type}</Badge></p>
                    <p className="truncate text-xs text-neutral-500">{it.name}</p>
                  </div>
                  <div className="text-right">
                    {it.quote ? (
                      <>
                        <p className="text-sm font-semibold">{formatPrice(it.quote.price, it.quote.currency)}</p>
                        <p className={`text-xs ${it.quote.change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                          {formatPercent(it.quote.changePercent)}
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-neutral-400">ราคาไม่พร้อมใช้</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent triggered */}
        <Card>
          <CardHeader title="Triggered ล่าสุด" action={<Link href="/notifications" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">ประวัติทั้งหมด</Link>} />
          {events === null ? (
            <CardBody className="space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
            </CardBody>
          ) : events.length === 0 ? (
            <EmptyState icon={<BellRing className="h-10 w-10" />} title="ยังไม่มีการแจ้งเตือน" description="Alert ที่ trigger จะแสดงที่นี่" />
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {events.map((ev) => (
                <div key={ev.id} className="px-5 py-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{ev.symbol}</p>
                    <Badge tone={ev.status === "TRIGGERED" ? "green" : "red"}>{ev.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    ราคา {formatPrice(Number(ev.currentPrice))} · เป้า {formatPrice(Number(ev.targetPrice))} · {timeAgo(ev.triggeredAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Alerts preview */}
      <Card>
        <CardHeader title="Active Alerts" action={<Link href="/alerts" className="text-sm text-emerald-600 hover:underline dark:text-emerald-400">จัดการทั้งหมด</Link>} />
        {alerts === null ? (
          <CardBody className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}
          </CardBody>
        ) : alerts.filter((a) => a.enabled).length === 0 ? (
          <EmptyState
            icon={<LineChart className="h-10 w-10" />}
            title="ยังไม่มี Active Alert"
            description='สร้าง Alert เช่น "แจ้งเตือนเมื่อ QQQM ≤ 180 USD"'
            action={<Link href="/alerts/create"><Button><Plus className="h-4 w-4" /> สร้าง Alert</Button></Link>}
          />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {alerts.filter((a) => a.enabled).slice(0, 5).map((a) => (
              <Link key={a.id} href={`/alerts/${a.id}/edit`} className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                <div>
                  <p className="text-sm font-semibold">{a.asset.symbol} · {a.name}</p>
                  <p className="text-xs text-neutral-500">
                    {a.condition === "ABOVE_OR_EQUAL" ? "≥" : "≤"} {formatPrice(Number(a.targetPrice))} · {a.type}
                  </p>
                </div>
                {a.lastTriggeredAt ? <span className="text-xs text-neutral-400">trigger {timeAgo(a.lastTriggeredAt)}</span> : <Badge tone="green">รอ trigger</Badge>}
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
