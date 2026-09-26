/**
 * Local market data — REAL quotes from Yahoo Finance only (no simulation).
 * Cached 60s per symbol; requires internet connection.
 */

export type StockQuote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  volume: number | null;
  currency: string;
  timestamp: number;
};

export type AssetSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: "STOCK" | "ETF";
  currency: string;
};

export function searchUniverse(keyword: string): AssetSearchResult[] {
  const UNIVERSE: AssetSearchResult[] = [
    { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "STOCK", currency: "USD" },
    { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "STOCK", currency: "USD" },
    { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "STOCK", currency: "USD" },
    { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", type: "STOCK", currency: "USD" },
    { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", type: "STOCK", currency: "USD" },
    { symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE Arca", type: "ETF", currency: "USD" },
    { symbol: "VTI", name: "Vanguard Total Stock Market ETF", exchange: "NYSE Arca", type: "ETF", currency: "USD" },
    { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", exchange: "NASDAQ", type: "ETF", currency: "USD" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", type: "ETF", currency: "USD" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "ETF", currency: "USD" },
  ];
  const q = keyword.trim().toUpperCase();
  if (!q) return UNIVERSE;
  return UNIVERSE.filter((a) => a.symbol.includes(q) || a.name.toUpperCase().includes(q));
}

// ---------- US market status (ET, approx DST handling) — same as server ----------

export type MarketState = "OPEN" | "CLOSED" | "PRE" | "POST";

export function getUsMarketStatus(date = new Date()): { state: MarketState; label: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));
  const minutes = hour * 60 + minute;

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return { state: "CLOSED", label: "Market Closed" };
  if (minutes >= 570 && minutes < 960) return { state: "OPEN", label: "Market Open" };
  if (minutes >= 240 && minutes < 570) return { state: "PRE", label: "Pre-Market" };
  if (minutes >= 960 && minutes < 1200) return { state: "POST", label: "After-Hours" };
  return { state: "CLOSED", label: "Market Closed" };
}

export function isMarketOpen(date = new Date()): boolean {
  return getUsMarketStatus(date).state === "OPEN";
}

// ---------- Optional REAL quotes (Yahoo Finance — free, no API key, may be delayed ~15 min for some exchanges) ----------

let realQuotesEnabled = true;

export function setRealQuotesEnabled(v: boolean): void {
  realQuotesEnabled = v;
}

export function isRealQuotesEnabled(): boolean {
  return realQuotesEnabled;
}

type RealCacheEntry = { quote: StockQuote; fetchedAt: number };
const realCache = new Map<string, RealCacheEntry>();
const REAL_TTL_MS = 60_000; // re-fetch at most once a minute per symbol

const YAHOO_HEADERS = { "User-Agent": "Mozilla/5.0" };

/** Live quote from Yahoo Finance chart API (real market data, no key needed). */
export async function fetchRealQuote(symbol: string): Promise<StockQuote | null> {
  const upper = symbol.toUpperCase();
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(upper)}?interval=1d&range=5d`,
      { headers: YAHOO_HEADERS },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            currency?: string;
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketDayHigh?: number;
            regularMarketDayLow?: number;
            regularMarketVolume?: number;
          };
        }>;
      };
    };
    const meta = json.chart?.result?.[0]?.meta;
    if (!meta || !Number.isFinite(meta.regularMarketPrice) || (meta.regularMarketPrice ?? 0) <= 0) return null;

    const price = meta.regularMarketPrice!;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = Math.round((price - prevClose) * 100) / 100;
    return {
      symbol: upper,
      price,
      change,
      changePercent: prevClose !== 0 ? Math.round((change / prevClose) * 10000) / 100 : 0,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      previousClose: prevClose,
      volume: meta.regularMarketVolume ?? null,
      currency: meta.currency ?? "USD",
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

/** Refresh stale entries in the real-quote cache (fire-and-forget friendly). */
export async function refreshRealQuotes(symbols: string[]): Promise<void> {
  if (!realQuotesEnabled) return;
  const now = Date.now();
  const stale = symbols
    .map((s) => s.toUpperCase())
    .filter((s) => {
      const hit = realCache.get(s);
      return !hit || now - hit.fetchedAt > REAL_TTL_MS;
    });
  await Promise.all(
    stale.map(async (s) => {
      const quote = await fetchRealQuote(s);
      if (quote) realCache.set(s, { quote, fetchedAt: Date.now() });
    }),
  );
}

/** Latest cached real quote, or null when missing/very stale (>5 min). */
export function getCachedRealQuote(symbol: string): StockQuote | null {
  const hit = realCache.get(symbol.toUpperCase());
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > 5 * 60_000) return null;
  return hit.quote;
}

/**
 * On-demand fetch: try to get a fresh quote from Yahoo Finance when
 * the cache is empty. Returns the quote or null if truly offline.
 */
export async function fetchAndCacheQuote(symbol: string): Promise<StockQuote | null> {
  const upper = symbol.toUpperCase();
  // Check cache first
  const cached = getCachedRealQuote(upper);
  if (cached) return cached;
  // Try to fetch fresh
  const quote = await fetchRealQuote(upper);
  if (quote) {
    realCache.set(upper, { quote, fetchedAt: Date.now() });
  }
  return quote;
}
