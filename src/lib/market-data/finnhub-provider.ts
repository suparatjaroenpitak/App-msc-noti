import type { AssetSearchResult, MarketDataProvider, StockQuote } from "@/types/market";

export class FinnhubProvider implements MarketDataProvider {
  constructor(private apiKey: string, private baseUrl = "https://finnhub.io/api/v1") {}

  async getQuote(symbol: string): Promise<StockQuote> {
    const res = await fetch(
      `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&token=${this.apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
    const json = (await res.json()) as { c?: number; d?: number; dp?: number; h?: number; l?: number; pc?: number };
    if (typeof json.c !== "number" || json.c === 0) throw new Error(`Finnhub: no quote for ${symbol}`);

    return {
      symbol: symbol.toUpperCase(),
      price: json.c,
      change: json.d ?? 0,
      changePercent: json.dp ?? 0,
      dayHigh: json.h ?? null,
      dayLow: json.l ?? null,
      previousClose: json.pc ?? null,
      volume: null, // Finnhub quote endpoint does not include volume
      currency: "USD",
      timestamp: Date.now(),
    };
  }

  async searchAssets(keyword: string): Promise<AssetSearchResult[]> {
    const res = await fetch(
      `${this.baseUrl}/search?q=${encodeURIComponent(keyword)}&token=${this.apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Finnhub search HTTP ${res.status}`);
    const json = (await res.json()) as { result?: Array<{ symbol: string; description: string; type: string }> };
    return (json.result ?? [])
      .filter((r) => r.symbol.includes(".") === false && (r.type === "Common Stock" || r.type === "ETP" || r.type === "ETF"))
      .slice(0, 20)
      .map((r) => ({
        symbol: r.symbol,
        name: r.description,
        exchange: "US",
        type: r.type === "ETP" || r.type === "ETF" ? ("ETF" as const) : ("STOCK" as const),
        currency: "USD",
      }));
  }
}
