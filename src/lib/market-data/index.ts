import { env } from "@/lib/env";
import type { MarketDataProvider, StockQuote } from "@/types/market";
import { MockProvider } from "./mock-provider";
import { TwelveDataProvider } from "./twelvedata-provider";
import { AlphaVantageProvider } from "./alphavantage-provider";
import { FinnhubProvider } from "./finnhub-provider";

// ---------- Provider factory ----------

let providerInstance: MarketDataProvider | undefined;

export function getMarketDataProvider(): MarketDataProvider {
  if (providerInstance) return providerInstance;
  switch (env.marketData.provider) {
    case "twelvedata":
      providerInstance = new TwelveDataProvider(requiredKey("TWELVE_DATA_API_KEY"));
      break;
    case "alphavantage":
      providerInstance = new AlphaVantageProvider(requiredKey("ALPHA_VANTAGE_API_KEY"));
      break;
    case "finnhub":
      providerInstance = new FinnhubProvider(requiredKey("FINNHUB_API_KEY"));
      break;
    default:
      // mock — development only
      providerInstance = new MockProvider();
  }
  return providerInstance;
}

function requiredKey(name: string): string {
  const v = process.env[name];
  if (!v || !v.trim()) throw new Error(`MARKET_DATA_PROVIDER requires ${name} to be set`);
  return v.trim();
}

/** Only for unit tests. */
export function setMarketDataProviderForTests(p: MarketDataProvider): void {
  providerInstance = p;
}

// ---------- Retry with exponential backoff ----------

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        const delay = baseDelayMs * 2 ** i + Math.random() * 250;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// ---------- Small TTL cache (per process) ----------

type CacheEntry = { value: StockQuote; expiresAt: number };
const quoteCache = new Map<string, CacheEntry>();
const QUOTE_TTL_MS = 30_000;

export async function getCachedQuote(symbol: string): Promise<StockQuote> {
  const key = symbol.toUpperCase();
  const hit = quoteCache.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) return hit.value;

  const quote = await withRetry(() => getMarketDataProvider().getQuote(key));
  quoteCache.set(key, { value: quote, expiresAt: now + QUOTE_TTL_MS });
  return quote;
}

// ---------- US market status (ET, approx DST handling) ----------

export type MarketState = "OPEN" | "CLOSED" | "PRE" | "POST";

export function getUsMarketStatus(date = new Date()): { state: MarketState; label: string } {
  // Convert to America/New_York time
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

/** Worker polls only when the market is open (plus a short post-open window). */
export function isMarketOpen(date = new Date()): boolean {
  return getUsMarketStatus(date).state === "OPEN";
}
