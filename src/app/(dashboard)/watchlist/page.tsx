"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, ChevronUp, ChevronDown, TrendingUp } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Input, Badge, Skeleton, EmptyState, ConfirmDialog } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { formatPrice, formatPercent } from "@/lib/utils";

type WatchItem = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  type: "STOCK" | "ETF";
  alertCount: number;
  quote: { price: number; change: number; changePercent: number; currency: string } | null;
};

type SearchResult = { symbol: string; name: string; exchange: string; type: "STOCK" | "ETF"; currency: string };

export default function WatchlistPage() {
  const toast = useToast();
  const [items, setItems] = useState<WatchItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<WatchItem | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: WatchItem[] }>("/api/watchlist");
      setItems(data.items);
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "โหลด Watchlist ไม่สำเร็จ");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Debounced search (300ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length === 0) {
      setResults(null);
      return;
    }
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
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const add = async (symbol: string) => {
    setAdding(symbol);
    try {
      await apiFetch("/api/watchlist", { method: "POST", body: JSON.stringify({ symbol }) });
      toast.push("success", `เพิ่ม ${symbol} เข้า Watchlist แล้ว`);
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "เพิ่มไม่สำเร็จ");
    } finally {
      setAdding(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusyDelete(true);
    try {
      await apiFetch(`/api/watchlist/${confirmDelete.id}`, { method: "DELETE" });
      toast.push("success", `ลบ ${confirmDelete.symbol} ออกจาก Watchlist แล้ว`);
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusyDelete(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!items) return;
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setItems(next); // optimistic
    try {
      await apiFetch("/api/watchlist/reorder", {
        method: "PATCH",
        body: JSON.stringify({ items: next.map((i) => i.id) }),
      });
    } catch {
      toast.push("error", "จัดเรียงไม่สำเร็จ");
      void load();
    }
  };

  const showSearch = query.trim().length > 0;
  const symbolsInList = useMemo(() => new Set(items?.map((i) => i.symbol) ?? []), [items]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Watchlist</h1>
        <span className="text-sm text-neutral-500">{items ? `${items.length} รายการ` : ""}</span>
      </div>

      {/* Search box */}
      <Card>
        <CardBody className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาหุ้น/ETF เช่น AAPL, NVDA, VOO, QQQM"
              className="pl-9"
              aria-label="ค้นหาหุ้น"
            />
          </div>
          {searching ? <p className="mt-2 text-xs text-neutral-400">กำลังค้นหา…</p> : null}
          {showSearch && results !== null && !searching ? (
            results.length === 0 ? (
              <p className="mt-3 text-sm text-neutral-500">ไม่พบผลลัพธ์สำหรับ &quot;{query}&quot;</p>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
                {results.map((r) => (
                  <li key={r.symbol} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">
                        {r.symbol} <Badge tone={r.type === "ETF" ? "blue" : "gray"}>{r.type}</Badge>
                      </p>
                      <p className="truncate text-xs text-neutral-500">{r.name} · {r.exchange}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={symbolsInList.has(r.symbol) ? "secondary" : "primary"}
                      disabled={symbolsInList.has(r.symbol) || adding === r.symbol}
                      onClick={() => void add(r.symbol)}
                    >
                      {symbolsInList.has(r.symbol) ? "มีแล้ว" : adding === r.symbol ? "…" : <><Plus className="h-3.5 w-3.5" /> เพิ่ม</>}
                    </Button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </CardBody>
      </Card>

      {/* List */}
      <Card>
        <CardHeader title="หุ้นที่ติดตาม" subtitle="เรียงลำดับด้วยปุ่มลูกศร" />
        {items === null ? (
          <CardBody className="space-y-3">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
          </CardBody>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="h-10 w-10" />}
            title="Watchlist ว่างเปล่า"
            description="ค้นหาและเพิ่มหุ้นที่สนใจด้านบน"
          />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {items.map((it, idx) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="flex flex-col">
                  <button
                    onClick={() => void move(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-200"
                    aria-label={`เลื่อน ${it.symbol} ขึ้น`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => void move(idx, 1)}
                    disabled={idx === items.length - 1}
                    className="rounded p-0.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:hover:text-neutral-200"
                    aria-label={`เลื่อน ${it.symbol} ลง`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <Link href={`/assets/${it.symbol}`} className="min-w-0 flex-1 hover:underline">
                  <p className="truncate text-sm font-semibold">
                    {it.symbol} <Badge tone={it.type === "ETF" ? "blue" : "gray"}>{it.type}</Badge>
                  </p>
                  <p className="truncate text-xs text-neutral-500">{it.name}</p>
                </Link>
                <div className="hidden text-right sm:block">
                  {it.quote ? (
                    <>
                      <p className="text-sm font-semibold">{formatPrice(it.quote.price, it.quote.currency)}</p>
                      <p className={`text-xs ${it.quote.change >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {it.quote.change >= 0 ? "+" : ""}{it.quote.change.toFixed(2)} ({formatPercent(it.quote.changePercent)})
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-neutral-400">—</p>
                  )}
                </div>
                <Badge tone={it.alertCount > 0 ? "green" : "gray"}>{it.alertCount} alert{it.alertCount !== 1 ? "s" : ""}</Badge>
                <button
                  onClick={() => setConfirmDelete(it)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  aria-label={`ลบ ${it.symbol}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`ลบ ${confirmDelete?.symbol ?? ""} ออกจาก Watchlist?`}
        description="Alert ที่ผูกกับหุ้นนี้จะไม่ถูกลบ คุณสามารถจัดการได้ในหน้า Alerts"
        destructive
        busy={busyDelete}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
