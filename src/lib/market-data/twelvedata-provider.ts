import type { AssetSearchResult, MarketDataProvider, StockQuote } from "@/types/market";

export class TwelveDataProvider implements MarketDataProvider {
  constructor(private apiKey: string, private baseUrl = "https://api.twelvedata.com") {}

  async getQuote(symbol: string): Promise<StockQuote> {
    const res = await fetch(
      `${this.baseUrl}/quote?symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Twelve Data HTTP ${res.status}`);
    const json = (await res.json()) as Record<string, unknown>;
    if (json.status === "error") throw new Error(String(json.message ?? "Twelve Data error"));

    const num = (v: unknown): number | null => (v === undefined || v === null ? null : Number(v));
    const price = num(json.close);
    if (price === null || Number.isNaN(price)) throw new Error("Twelve Data: missing close price");
    const previousClose = num(json.previous_close);

    return {
      symbol: String(json.symbol ?? symbol).toUpperCase(),
      price,
      change: num(json.change) ?? (previousClose !== null ? price - previousClose : 0),
      changePercent: num(json.percent_change) ?? 0,
      dayHigh: num(json.high),
      dayLow: num(json.low),
      previousClose,
      volume: num(json.volume),
      currency: String(json.currency ?? "USD"),
      timestamp: Date.now(),
    };
  }

  async searchAssets(keyword: string): Promise<AssetSearchResult[]> {
    const res = await fetch(
      `${this.baseUrl}/symbol_search?symbol=${encodeURIComponent(keyword)}&apikey=${this.apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Twelve Data search HTTP ${res.status}`);
    const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
    return (json.data ?? [])
      .filter((d) => {
        const t = String(d.instrument_type ?? "").toUpperCase();
        const country = String(d.country ?? "").toUpperCase();
        return (t.includes("COMMON") || t.includes("ETF")) && (country === "UNITED STATES" || country === "USA");
      })
      .slice(0, 20)
      .map((d) => ({
        symbol: String(d.symbol),
        name: String(d.instrument_name ?? d.symbol),
        exchange: String(d.exchange ?? ""),
        type: String(d.instrument_type ?? "").toUpperCase().includes("ETF") ? ("ETF" as const) : ("STOCK" as const),
        currency: String(d.currency ?? "USD"),
      }));
  }
}
