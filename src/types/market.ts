export type AssetTypeDto = "STOCK" | "ETF";

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  volume: number | null;
  currency: string;
  timestamp: number; // epoch ms
}

export interface AssetSearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: AssetTypeDto;
  currency: string;
}

/** Central market data interface — swap providers without touching business logic. */
export interface MarketDataProvider {
  getQuote(symbol: string): Promise<StockQuote>;
  searchAssets(keyword: string): Promise<AssetSearchResult[]>;
}

export interface MarketHistoryPoint {
  time: string; // ISO
  price: number;
}
