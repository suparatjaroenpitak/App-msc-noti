import * as SQLite from "expo-sqlite";

/**
 * Local database — the entire "backend" now lives on the device.
 * Mirrors the server's SQLite schema (assets, watchlist, alert rules/events,
 * analysis, preferences) so screens keep working with zero changes.
 */

export type AssetRow = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  type: "STOCK" | "ETF";
  currency: string;
};

export type WatchRow = {
  id: string;
  assetId: string;
  sortOrder: number;
};

export type AlertRuleRow = {
  id: string;
  assetId: string;
  name: string;
  type: "ENTRY" | "EXIT" | "CUSTOM";
  condition: "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";
  targetPrice: number;
  enabled: boolean;
  oneTime: boolean;
  cooldownMinutes: number;
  notificationMessage: string | null;
  soundId: string | null;
  lastTriggeredAt: string | null;
};

export type AlertEventRow = {
  id: string;
  alertRuleId: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  triggeredAt: string;
  status: "TRIGGERED" | "FAILED";
  metadata: string | null;
};

export type NotificationLogRow = {
  id: string;
  alertEventId: string | null;
  title: string;
  body: string;
  status: "SENT" | "FAILED";
  errorMessage: string | null;
  sentAt: string;
};

export type AnalysisRow = {
  id: string;
  assetId: string;
  alertEventId: string | null;
  symbol: string;
  kind: "ON_TRIGGER" | "SUGGEST_PRICE";
  priceAtAnalysis: number;
  engine: string;
  verdict: string | null;
  suggestedEntryPrice: number | null;
  suggestedStopPrice: number | null;
  suggestedTargetPrice: number | null;
  confidence: number | null;
  horizonDays: number | null;
  rationale: string | null;
  ok: boolean;
  error: string | null;
  createdAt: string;
};

export type AnalysisSettingsRow = {
  enabled: boolean;
  suggestOnCreate: boolean;
  analyzeOnTrigger: boolean;
  lookbackMinutes: number;
  minSamples: number;
};

export type NotificationPreferenceRow = {
  pushEnabled: boolean;
  entryEnabled: boolean;
  exitEnabled: boolean;
  customEnabled: boolean;
  defaultSoundId: string | null;
  volume: number;
};

let dbInstance: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync("stock-alert.db");
  }
  return dbInstance;
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Create tables if missing + seed the 10-asset universe on first launch. */
export function initDb(): void {
  const db = getDb();
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      symbol TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      exchange TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'USD'
    );

    CREATE TABLE IF NOT EXISTS watchlist_items (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT NOT NULL REFERENCES assets(id),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_rules (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT NOT NULL REFERENCES assets(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      condition TEXT NOT NULL,
      target_price REAL NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      one_time INTEGER NOT NULL DEFAULT 0,
      cooldown_minutes INTEGER NOT NULL DEFAULT 60,
      notification_message TEXT,
      sound_id TEXT,
      last_triggered_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS alert_events (
      id TEXT PRIMARY KEY NOT NULL,
      alert_rule_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      current_price REAL NOT NULL,
      target_price REAL NOT NULL,
      triggered_at TEXT NOT NULL,
      status TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id TEXT PRIMARY KEY NOT NULL,
      alert_event_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT NOT NULL,
      alert_event_id TEXT,
      symbol TEXT NOT NULL,
      kind TEXT NOT NULL,
      price_at_analysis REAL NOT NULL,
      engine TEXT NOT NULL DEFAULT 'builtin-v1',
      verdict TEXT,
      suggested_entry_price REAL,
      suggested_stop_price REAL,
      suggested_target_price REAL,
      confidence REAL,
      horizon_days INTEGER,
      rationale TEXT,
      ok INTEGER NOT NULL DEFAULT 1,
      error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS analysis_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      enabled INTEGER NOT NULL DEFAULT 1,
      suggest_on_create INTEGER NOT NULL DEFAULT 1,
      analyze_on_trigger INTEGER NOT NULL DEFAULT 0,
      lookback_minutes INTEGER NOT NULL DEFAULT 240,
      min_samples INTEGER NOT NULL DEFAULT 12
    );

    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      push_enabled INTEGER NOT NULL DEFAULT 1,
      entry_enabled INTEGER NOT NULL DEFAULT 1,
      exit_enabled INTEGER NOT NULL DEFAULT 1,
      custom_enabled INTEGER NOT NULL DEFAULT 1,
      default_sound_id TEXT,
      volume REAL NOT NULL DEFAULT 0.8
    );

    CREATE TABLE IF NOT EXISTS price_samples (
      id TEXT PRIMARY KEY NOT NULL,
      asset_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      volume INTEGER,
      sampled_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_samples_asset_time ON price_samples(asset_id, sampled_at);

    CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
  `);

  // Singleton settings rows.
  const one = db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM analysis_settings");
  if (!one || one.n === 0) {
    db.runSync("INSERT INTO analysis_settings (id) VALUES (1)");
  }
  const two = db.getFirstSync<{ n: number }>("SELECT COUNT(*) AS n FROM notification_preferences");
  if (!two || two.n === 0) {
    db.runSync("INSERT INTO notification_preferences (id) VALUES (1)");
  }

  seedAssets();
}

const UNIVERSE: Array<{ symbol: string; name: string; exchange: string; type: "STOCK" | "ETF" }> = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE Arca", type: "ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", exchange: "NYSE Arca", type: "ETF" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", exchange: "NASDAQ", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", type: "ETF" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "ETF" },
];

/** Seed assets on first run; add any symbol the user searches for later on demand. */
function seedAssets(): void {
  const db = getDb();
  for (const a of UNIVERSE) {
    const existing = db.getFirstSync<{ id: string }>("SELECT id FROM assets WHERE symbol = ?", [a.symbol]);
    if (!existing) {
      db.runSync("INSERT INTO assets (id, symbol, name, exchange, type, currency) VALUES (?, ?, ?, ?, ?, ?)", [
        uid("ast"),
        a.symbol,
        a.name,
        a.exchange,
        a.type,
        "USD",
      ]);
    }
  }
}

/** kv helpers (worker state etc.). */
export function kvGet(key: string): string | null {
  const row = getDb().getFirstSync<{ value: string }>("SELECT value FROM kv WHERE key = ?", [key]);
  return row?.value ?? null;
}

export function kvSet(key: string, value: string): void {
  getDb().runSync("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}
