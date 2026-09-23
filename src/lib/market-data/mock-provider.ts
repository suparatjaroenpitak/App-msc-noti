import type { AssetSearchResult, MarketDataProvider, StockQuote } from "@/types/market";

/**
 * DEVELOPMENT ONLY — deterministic pseudo-random walk from a seed per symbol.
 * Never enable MARKET_DATA_PROVIDER=mock in production.
 */
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

const BASE_PRICES: Record<string, number> = {
  AAPL: 227.5, MSFT: 428.1, NVDA: 132.4, TSLA: 246.8, AMZN: 205.3,
  VOO: 560.2, VTI: 295.6, QQQM: 218.9, QQQ: 495.4, SPY: 575.8,
};

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

export class MockProvider implements MarketDataProvider {
  async getQuote(symbol: string): Promise<StockQuote> {
    const upper = symbol.toUpperCase();
    const base = BASE_PRICES[upper];
    if (!base) {
      throw new Error(`Unknown symbol in mock provider: ${upper}`);
    }
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
      dayHigh: Math.round((Math.max(price, prevClose) * 1.005) * 100) / 100,
      dayLow: Math.round((Math.min(price, prevClose) * 0.995) * 100) / 100,
      previousClose: prevClose,
      volume: 1_000_000 + Math.abs(Math.floor(seededNoise(upper, now) * 5_000_000)),
      currency: "USD",
      timestamp: now,
    };
  }

  async searchAssets(keyword: string): Promise<AssetSearchResult[]> {
    const q = keyword.trim().toUpperCase();
    if (!q) return UNIVERSE;
    return UNIVERSE.filter(
      (a) => a.symbol.includes(q) || a.name.toUpperCase().includes(q),
    );
  }
}
