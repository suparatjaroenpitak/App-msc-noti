export type Quote = {
  price: number;
  change: number;
  changePercent: number;
  currency: string;
};

export type WatchItem = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  alertCount: number;
  quote: Quote | null;
};

export type AssetSearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
};

export type AlertRow = {
  id: string;
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: number | string;
  enabled: boolean;
  oneTime: boolean;
  cooldownMinutes: number;
  lastTriggeredAt: string | null;
  notificationMessage?: string | null;
  soundId?: string | null;
  sound?: { name: string } | null;
  asset: { symbol: string; name: string };
};

export type AlertEventRow = {
  id: string;
  symbol: string;
  currentPrice: number | string;
  targetPrice: number | string;
  triggeredAt: string;
  status: "TRIGGERED" | "FAILED";
};

export type SoundRow = {
  id: string;
  name: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  duration: number | null;
  isDefault: boolean;
  createdAt: string;
};

export type Preferences = {
  pushEnabled: boolean;
  entryEnabled: boolean;
  exitEnabled: boolean;
  customEnabled: boolean;
  defaultSoundId: string | null;
  volume: number;
};

export type SystemStatus = {
  db: boolean;
  pushConfigured: boolean;
  marketDataProvider: string;
  marketDataProviderHealthy: boolean;
  market: { state: string; label: string };
};

export type AlertActionResult = {
  test?: boolean;
  sent?: number;
  failed?: number;
  reason?: string;
};

export type Paged<T> = { page: number; pageSize: number; total: number };

export type AlertEventDetail = AlertEventRow & {
  alertRule: { id: string; name: string } | null;
};

export type NotificationLogRow = {
  id: string;
  title: string;
  body: string;
  status: string; // SENT | FAILED
  errorMessage: string | null;
  sentAt: string;
};

export type AnalysisRow = {
  id: string;
  symbol: string;
  kind: string; // ON_TRIGGER | SUGGEST_PRICE
  priceAtAnalysis: number;
  verdict: string | null; // BUY | WAIT | AVOID
  suggestedEntryPrice: number | null;
  suggestedStopPrice: number | null;
  suggestedTargetPrice: number | null;
  confidence: number | null;
  horizonDays: number | null;
  rationale: string | null;
  createdAt: string;
};

export type AnalysisSettings = {
  enabled: boolean;
  suggestOnCreate: boolean;
  analyzeOnTrigger: boolean;
  lookbackMinutes: number;
  minSamples: number;
};

export type Suggestion = {
  engine: string;
  verdict: string | null; // BUY | SELL | HOLD | WAIT | AVOID
  suggestedEntryPrice: number | null;
  suggestedStopPrice: number | null;
  suggestedTargetPrice: number | null;
  confidence: number | null;
  horizonDays: number | null;
  rationale: string | null;
};

export type SuggestPriceResult = {
  suggestion: Suggestion;
};

export type QuoteDetail = Quote & {
  dayHigh?: number;
  dayLow?: number;
  previousClose?: number;
};

export type AssetDetail = {
  asset: {
    id: string;
    symbol: string;
    name: string;
    exchange: string;
    type: string;
    currency: string;
  };
  quote: QuoteDetail | null;
};
