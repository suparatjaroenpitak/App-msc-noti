import type { AssetSearchResult, MarketDataProvider, StockQuote } from "@/types/market";

export class AlphaVantageProvider implements MarketDataProvider {
  constructor(private apiKey: string, private baseUrl = "https://www.alphavantage.co") {}

  async getQuote(symbol: string): Promise<StockQuote> {
    const res = await fetch(
      `${this.baseUrl}/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=${this.apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
    const json = (await res.json()) as { "Global Quote"?: Record<string, string> };
    const q = json["Global Quote"];
    if (!q || !q["05. price"]) throw new Error("Alpha Vantage: empty quote (rate limit or unknown symbol)");

    const price = Number(q["05. price"]);
    const change = Number(q["09. change"] ?? "0");
    const prevClose = q["08. previous close"] ? Number(q["08. previous close"]) : null;

    return {
      symbol: String(q["01. symbol"] ?? symbol).toUpperCase(),
      price,
      change,
      changePercent: Number((q["10. change percent"] ?? "0%").replace("%", "")),
      dayHigh: q["03. high"] ? Number(q["03. high"]) : null,
      dayLow: q["02. low"] ? Number(q["02. low"]) : null,
      previousClose: prevClose,
      volume: q["06. volume"] ? Number(q["06. volume"]) : null,
      currency: "USD",
      timestamp: Date.now(),
    };
  }

  async searchAssets(keyword: string): Promise<AssetSearchResult[]> {
    const res = await fetch(
      `${this.baseUrl}/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(keyword)}&apikey=${this.apiKey}`,
      { cache: "no-store" },
    );
    if (!res.ok) throw new Error(`Alpha Vantage search HTTP ${res.status}`);
    const json = (await res.json()) as { bestMatches?: Array<Record<string, string>> };
    return (json.bestMatches ?? [])
      .filter((m) => m["3. type"] === "Equity" || m["3. type"] === "ETF")
      .slice(0, 20)
      .map((m) => ({
        symbol: String(m["1. symbol"]),
        name: String(m["2. name"]),
        exchange: String(m["4. region"] ?? "US"),
        type: m["3. type"] === "ETF" ? ("ETF" as const) : ("STOCK" as const),
        currency: String(m["8. currency"] ?? "USD"),
      }));
  }
}
