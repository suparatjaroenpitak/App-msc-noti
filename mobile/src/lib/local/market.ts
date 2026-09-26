/**
 * Local market data — ported from the server's MockProvider.
 * Deterministic pseudo-random walk seeded per symbol; no network needed.
 * Prices are simulated (clearly labelled in the UI).
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

const BASE_PRICES: Record<string, number> = {
  AAPL: 227.5, MSFT: 428.1, NVDA: 132.4, TSLA: 246.8, AMZN: 205.3,
  VOO: 560.2, VTI: 295.6, QQQM: 218.9, QQQ: 495.4, SPY: 575.8,
};

/** Extra symbols the user may add later — derive a stable base price from the name. */
function basePriceFor(symbol: string): number {
  const known = BASE_PRICES[symbol.toUpperCase()];
  if (known) return known;
  let h = 2166136261;
  const s = symbol.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 20 + ((h >>> 0) % 48000) / 100; // $20–$500 deterministic
}

function seededNoise(symbol: string, t: number): number {
  let h = 2166136261;
  const s = `${symbol}:${Math.floor(t / 60_000)}`; // changes every minute
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const x = (h >>> 0) / 4294967295; // 0..1
  return (x - 0.5) * 2; // -1..1
}

export function getQuote(symbol: string): StockQuote {
  const upper = symbol.toUpperCase();
  const base = basePriceFor(upper);
  const now = Date.now();
  const drift = seededNoise(upper, now) * base * 0.004;
  const price = Math.round((base + drift) * 100) / 100;
  const prevClose = Math.round((base + seededNoise(upper, now - 86_400_000) * base * 0.004) * 100) / 100;
  const change = Math.round((price - prevClose) * 100) / 100;
  return {
    symbol: upper,
    price,
    change,
    changePercent: prevClose !== 0 ? Math.round((change / prevClose) * 10000) / 100 : 0,
    dayHigh: Math.round(Math.max(price, prevClose) * 1.005 * 100) / 100,
    dayLow: Math.round(Math.min(price, prevClose) * 0.995 * 100) / 100,
    previousClose: prevClose,
    volume: 1_000_000 + Math.abs(Math.floor(seededNoise(upper, now) * 5_000_000)),
    currency: "USD",
    timestamp: now,
  };
}

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
