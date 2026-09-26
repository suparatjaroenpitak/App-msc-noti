import {
  getDb,
  initDb,
  kvGet,
  kvSet,
  uid,
  type AlertEventRow,
  type AlertRuleRow,
  type AnalysisRow,
  type AnalysisSettingsRow,
  type AssetRow,
  type NotificationLogRow,
  type NotificationPreferenceRow,
} from "./db";
import { getQuote, getUsMarketStatus, isMarketOpen, searchUniverse, type AssetSearchResult, type StockQuote } from "./market";
import { analyze, type EngineInput } from "./analysis-engine";
import { playForAlert } from "../local-sounds";

/**
 * The entire backend, running on-device.
 * Implements every endpoint the screens call — same JSON shapes as the old
 * Render API — but everything is served from local SQLite. No network.
 */

let initialized = false;

export function ensureBackend(): void {
  if (!initialized) {
    initDb();
    initialized = true;
  }
}

// ---------- row mappers ----------

type AssetDbRow = { id: string; symbol: string; name: string; exchange: string; type: string; currency: string };

type SQLiteBindValue = string | number | null;

function mapAsset(r: AssetDbRow): AssetRow {
  return { id: r.id, symbol: r.symbol, name: r.name, exchange: r.exchange, type: r.type as AssetRow["type"], currency: r.currency };
}

function isoOrNull(s: string | null): string | null {
  return s ?? null;
}

// ---------- assets ----------

function findAssetBySymbol(symbol: string): AssetRow | null {
  const row = getDb().getFirstSync<AssetDbRow>("SELECT * FROM assets WHERE symbol = ?", [symbol.toUpperCase()]);
  return row ? mapAsset(row) : null;
}

function ensureAsset(symbol: string): AssetRow {
  const existing = findAssetBySymbol(symbol);
  if (existing) return existing;
  const universe = searchUniverse(symbol).find((a) => a.symbol === symbol.toUpperCase());
  const db = getDb();
  const id = uid("ast");
  db.runSync("INSERT INTO assets (id, symbol, name, exchange, type, currency) VALUES (?, ?, ?, ?, ?, ?)", [
    id,
    symbol.toUpperCase(),
    universe?.name ?? symbol.toUpperCase(),
    universe?.exchange ?? "UNKNOWN",
    universe?.type ?? "STOCK",
    "USD",
  ]);
  return findAssetBySymbol(symbol)!;
}

// ---------- alert engine (local worker) ----------

function conditionMet(condition: string, price: number, target: number): boolean {
  if (condition === "ABOVE_OR_EQUAL") return price >= target;
  return price <= target; // BELOW_OR_EQUAL
}

function recordNotification(alertEventId: string | null, title: string, body: string, status: "SENT" | "FAILED", errorMessage?: string): void {
  getDb().runSync(
    "INSERT INTO notification_logs (id, alert_event_id, title, body, status, error_message, sent_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [uid("nl"), alertEventId, title, body, status, errorMessage ?? null, new Date().toISOString()],
  );
}

/**
 * One poll cycle — port of the server worker. Evaluates every enabled rule,
 * records AlertEvent rows, plays the local sound for triggers, and deactivates
 * one-time rules. Safe to call frequently.
 */
export function runLocalPollCycle(options?: { force?: boolean }): { evaluated: number; triggered: number } {
  ensureBackend();
  const db = getDb();
  if (!options?.force && !isMarketOpen()) return { evaluated: 0, triggered: 0 };

  const rules = db.getAllSync<Record<string, unknown>>(
    `SELECT r.*, a.symbol, a.name AS asset_name, a.type AS asset_type
     FROM alert_rules r JOIN assets a ON a.id = r.asset_id
     WHERE r.enabled = 1`,
  ) as unknown as Array<AlertRuleRow & { symbol: string; asset_name: string; asset_type: string }>;

  let triggered = 0;
  const now = Date.now();

  for (const rule of rules) {
    const quote = getQuote(rule.symbol);
    // Persist a sample for the analysis engine (dedupe per minute).
    const minuteBucket = new Date(Math.floor(now / 60_000) * 60_000).toISOString();
    const sampleId = `${rule.assetId}:${minuteBucket}`;
    const hasSample = db.getFirstSync("SELECT 1 FROM price_samples WHERE id = ?", [sampleId]);
    if (!hasSample) {
      db.runSync("INSERT INTO price_samples (id, asset_id, symbol, price, volume, sampled_at) VALUES (?, ?, ?, ?, ?, ?)", [
        sampleId,
        rule.assetId,
        rule.symbol,
        quote.price,
        quote.volume != null ? Math.round(quote.volume) : null,
        new Date().toISOString(),
      ]);
    }

    if (!conditionMet(rule.condition, quote.price, rule.targetPrice)) continue;

    // Cooldown.
    if (rule.lastTriggeredAt && now - new Date(rule.lastTriggeredAt).getTime() < rule.cooldownMinutes * 60_000) continue;

    triggered += 1;
    const nowIso = new Date().toISOString();
    db.runSync("UPDATE alert_rules SET last_triggered_at = ? WHERE id = ?", [nowIso, rule.id]);

    const eventId = uid("evt");
    db.runSync(
      "INSERT INTO alert_events (id, alert_rule_id, symbol, current_price, target_price, triggered_at, status, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [
        eventId,
        rule.id,
        rule.symbol,
        quote.price,
        rule.targetPrice,
        nowIso,
        "TRIGGERED",
        JSON.stringify({ condition: rule.condition, type: rule.type, priceAtTrigger: quote.price }),
      ],
    );

    // Play the device-selected sound (respecting per-alert override via kv).
    void playForAlert(rule.id);

    const dir = rule.condition === "ABOVE_OR_EQUAL" ? "ขึ้นถึง" : "ลงถึง";
    const title = `🔔 ${rule.symbol} ${dir} $${rule.targetPrice.toFixed(2)}`;
    const body = `ราคาปัจจุบัน $${quote.price.toFixed(2)} · ${rule.asset_name}${rule.notificationMessage ? `\n${rule.notificationMessage}` : ""}`;
    recordNotification(eventId, title, body, "SENT");

    if (rule.oneTime) {
      db.runSync("UPDATE alert_rules SET enabled = 0 WHERE id = ?", [rule.id]);
    }
  }

  return { evaluated: rules.length, triggered };
}

/** Poll state persisted in kv. */
const POLL_KEY = "poll.lastRunAt";

export function maybeAutoPoll(): void {
  const last = Number(kvGet(POLL_KEY) ?? "0");
  const now = Date.now();
  if (now - last >= 30_000) {
    kvSet(POLL_KEY, String(now));
    try {
      runLocalPollCycle();
    } catch {
      // never crash the UI for background polling
    }
  }
}

// ---------- analysis service ----------

function getAnalysisSettings(): AnalysisSettingsRow {
  ensureBackend();
  const row = getDb().getFirstSync<Record<string, unknown>>("SELECT * FROM analysis_settings WHERE id = 1")!;
  return {
    enabled: Boolean(row.enabled),
    suggestOnCreate: Boolean(row.suggest_on_create),
    analyzeOnTrigger: Boolean(row.analyze_on_trigger),
    lookbackMinutes: Number(row.lookback_minutes),
    minSamples: Number(row.min_samples),
  };
}

function fetchRecentPrices(assetId: string, lookbackMinutes: number): number[] {
  const since = new Date(Date.now() - lookbackMinutes * 60_000).toISOString();
  const rows = getDb().getAllSync<{ price: number }>(
    "SELECT price FROM price_samples WHERE asset_id = ? AND sampled_at >= ? ORDER BY sampled_at ASC",
    [assetId, since],
  );
  return rows.map((r) => r.price);
}

function persistAnalysis(params: {
  assetId: string;
  alertEventId: string | null;
  symbol: string;
  kind: "ON_TRIGGER" | "SUGGEST_PRICE";
  price: number;
  result: ReturnType<typeof analyze> | null;
  error?: string;
}): void {
  const db = getDb();
  db.runSync(
    `INSERT INTO analyses (id, asset_id, alert_event_id, symbol, kind, price_at_analysis, engine, verdict,
      suggested_entry_price, suggested_stop_price, suggested_target_price, confidence, horizon_days, rationale, ok, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uid("anl"),
      params.assetId,
      params.alertEventId,
      params.symbol,
      params.kind,
      params.price,
      params.result?.engine ?? "builtin-v1",
      params.result?.verdict ?? null,
      params.result?.suggestedEntryPrice ?? null,
      params.result?.suggestedStopPrice ?? null,
      params.result?.suggestedTargetPrice ?? null,
      params.result?.confidence ?? null,
      params.result?.horizonDays ?? null,
      params.result?.rationale ?? null,
      params.result ? 1 : 0,
      params.error ?? null,
      new Date().toISOString(),
    ],
  );
}

function suggestEntryPrice(symbol: string, quote: StockQuote): { ok: true; result: ReturnType<typeof analyze> } | { ok: false; error: string } {
  const settings = getAnalysisSettings();
  if (!settings.enabled || !settings.suggestOnCreate) {
    return { ok: false, error: "ปิดใช้งานการวิเคราะห์อยู่ (หน้าตั้งค่าการวิเคราะห์)" };
  }
  const asset = findAssetBySymbol(symbol);
  if (!asset) return { ok: false, error: "ไม่พบหุ้นนี้ในระบบ" };

  const recentPrices = fetchRecentPrices(asset.id, settings.lookbackMinutes);
  const engineInput: EngineInput = {
    symbol: asset.symbol,
    assetName: asset.name,
    assetType: asset.type,
    currentPrice: quote.price,
    currency: "USD",
    recentPrices,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    previousClose: quote.previousClose,
    lookbackMinutes: settings.lookbackMinutes,
    minSamples: settings.minSamples,
  };
  const result = analyze(engineInput);
  persistAnalysis({ assetId: asset.id, alertEventId: null, symbol: asset.symbol, kind: "SUGGEST_PRICE", price: quote.price, result });
  return { ok: true, result };
}

// ---------- router ----------

export type LocalResponse<T> = { ok: true; data: T } | { ok: false; status: number; code: string; message: string };

function ok<T>(data: T): LocalResponse<T> {
  return { ok: true, data };
}

function fail(status: number, code: string, message: string): LocalResponse<never> {
  return { ok: false, status, code, message };
}

function quoteFor(symbol: string): StockQuote {
  return getQuote(symbol);
}

/**
 * Handle an API call entirely locally. Mirrors the server route shapes.
 * Returns null when the path is unknown (caller can fall back).
 */
export function handleLocalApi<T>(method: string, path: string, body?: unknown): LocalResponse<T> | null {
  ensureBackend();
  const db = getDb();
  const m = method.toUpperCase();
  const [pathname, query] = path.split("?");
  const segments = pathname.replace(/^\/api\//, "").split("/").filter(Boolean);
  const params = new URLSearchParams(query ?? "");

  // ---- system ----
  if (pathname === "/api/system/status") {
    const market = getUsMarketStatus();
    return ok({
      db: true,
      pushConfigured: false,
      marketDataProvider: "local-mock",
      marketDataProviderHealthy: true,
      market: { state: market.state, label: market.label },
      timestamp: new Date().toISOString(),
    } as unknown as T);
  }

  if (pathname === "/api/health") {
    return ok({ status: "ok", db: true, local: true } as unknown as T);
  }

  if (pathname === "/api/auth-user") {
    return ok({ user: { id: "local", name: "ผู้ใช้ในเครื่อง", email: "local@device" } } as unknown as T);
  }

  // ---- assets ----
  if (segments[0] === "assets" && segments[1] === "search" && m === "GET") {
    const q = params.get("q") ?? "";
    return ok({ results: searchUniverse(q) } as unknown as T);
  }

  if (segments[0] === "assets" && segments[1] && m === "GET") {
    const symbol = decodeURIComponent(segments[1]).toUpperCase();
    const asset = ensureAsset(symbol);
    const quote = quoteFor(symbol);
    return ok({
      asset,
      quote: {
        symbol: quote.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        currency: quote.currency,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        previousClose: quote.previousClose,
        volume: quote.volume,
        timestamp: new Date(quote.timestamp).toISOString(),
      },
    } as unknown as T);
  }

  if (segments[0] === "market" && segments[1] === "quote" && segments[2] && m === "GET") {
    const q = quoteFor(decodeURIComponent(segments[2]));
    return ok({ quote: { ...q, timestamp: new Date(q.timestamp).toISOString() } } as unknown as T);
  }

  // ---- watchlist ----
  if (pathname === "/api/watchlist" && m === "GET") {
    const items = db.getAllSync<Record<string, unknown>>(
      `SELECT w.id, a.symbol, a.name, a.exchange, a.type,
        (SELECT COUNT(*) FROM alert_rules r WHERE r.asset_id = a.id AND r.enabled = 1) AS alert_count
       FROM watchlist_items w JOIN assets a ON a.id = w.asset_id
       ORDER BY w.sort_order ASC, w.created_at ASC`,
    );
    const result = items.map((row) => {
      const q = quoteFor(String(row.symbol));
      return {
        id: String(row.id),
        symbol: String(row.symbol),
        name: String(row.name),
        exchange: String(row.exchange),
        type: String(row.type),
        alertCount: Number(row.alert_count),
        quote: { price: q.price, change: q.change, changePercent: q.changePercent, currency: q.currency },
      };
    });
    return ok({ items: result } as unknown as T);
  }

  if (pathname === "/api/watchlist" && m === "POST") {
    const b = body as { symbol?: string };
    const symbol = String(b?.symbol ?? "").toUpperCase();
    if (!symbol) return fail(400, "BAD_REQUEST", "ระบุ symbol ก่อน");
    const asset = ensureAsset(symbol);
    const dup = db.getFirstSync("SELECT id FROM watchlist_items WHERE asset_id = ?", [asset.id]);
    if (dup) return fail(409, "CONFLICT", "อยู่ใน watchlist อยู่แล้ว");
    const max = db.getFirstSync<{ m: number | null }>("SELECT MAX(sort_order) AS m FROM watchlist_items");
    const id = uid("wch");
    db.runSync("INSERT INTO watchlist_items (id, asset_id, sort_order, created_at) VALUES (?, ?, ?, ?)", [
      id,
      asset.id,
      (max?.m ?? -1) + 1,
      new Date().toISOString(),
    ]);
    return ok({ item: { id, assetId: asset.id } } as unknown as T);
  }

  if (segments[0] === "watchlist" && segments[1] && segments[2] === undefined && m === "DELETE") {
    db.runSync("DELETE FROM watchlist_items WHERE id = ?", [segments[1]]);
    return ok({ deleted: true } as unknown as T);
  }

  if (pathname === "/api/watchlist/reorder" && m === "PATCH") {
    const b = body as { items?: string[] };
    const ids = Array.isArray(b?.items) ? b!.items : [];
    ids.forEach((id, index) => {
      db.runSync("UPDATE watchlist_items SET sort_order = ? WHERE id = ?", [index, id]);
    });
    return ok({ reordered: true } as unknown as T);
  }

  // ---- alerts ----
  if (pathname === "/api/alerts" && m === "GET") {
    const rows = db.getAllSync<Record<string, unknown>>(
      `SELECT r.*, a.symbol, a.name AS asset_name FROM alert_rules r JOIN assets a ON a.id = r.asset_id
       ORDER BY r.created_at DESC`,
    );
    const alerts = rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      type: String(row.type),
      condition: String(row.condition),
      targetPrice: Number(row.target_price),
      enabled: Boolean(row.enabled),
      oneTime: Boolean(row.one_time),
      cooldownMinutes: Number(row.cooldown_minutes),
      lastTriggeredAt: isoOrNull(row.last_triggered_at as string | null),
      notificationMessage: (row.notification_message as string | null) ?? null,
      soundId: (row.sound_id as string | null) ?? null,
      sound: null,
      asset: { symbol: String(row.symbol), name: String(row.asset_name) },
    }));
    return ok({ alerts } as unknown as T);
  }

  if (pathname === "/api/alerts" && m === "POST") {
    const b = body as Record<string, unknown>;
    const assetId = String(b.assetId ?? "");
    const assetRow = db.getFirstSync<Record<string, string>>("SELECT * FROM assets WHERE id = ?", [assetId]);
    if (!assetRow) return fail(400, "BAD_REQUEST", "ไม่พบหุ้นที่เลือก");
    const id = uid("alr");
    db.runSync(
      `INSERT INTO alert_rules (id, asset_id, name, type, condition, target_price, enabled, one_time, cooldown_minutes, notification_message, sound_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        assetId,
        String(b.name ?? "Alert"),
        String(b.type ?? "CUSTOM"),
        String(b.condition ?? "ABOVE_OR_EQUAL"),
        Number(b.targetPrice),
        b.enabled === false ? 0 : 1,
        b.oneTime ? 1 : 0,
        Number(b.cooldownMinutes ?? 60),
        (b.notificationMessage as string | null) ?? null,
        null, // soundId is a device-local override now
        new Date().toISOString(),
      ],
    );

    // Optional local analysis on create (same behaviour as the server).
    try {
      const settings = getAnalysisSettings();
      if (settings.enabled && settings.suggestOnCreate) {
        const quote = quoteFor(String(assetRow.symbol));
        suggestEntryPrice(String(assetRow.symbol), quote);
      }
    } catch {
      // analysis is optional
    }

    const alertRow = db.getFirstSync<Record<string, unknown>>("SELECT * FROM alert_rules WHERE id = ?", [id])!;
    return ok({
      alert: {
        id,
        name: String(alertRow.name),
        type: String(alertRow.type),
        condition: String(alertRow.condition),
        targetPrice: Number(alertRow.target_price),
        enabled: Boolean(alertRow.enabled),
        oneTime: Boolean(alertRow.one_time),
        cooldownMinutes: Number(alertRow.cooldown_minutes),
        lastTriggeredAt: null,
        notificationMessage: (alertRow.notification_message as string | null) ?? null,
        soundId: null,
        asset: { symbol: String(assetRow.symbol), name: String(assetRow.name) },
      },
    } as unknown as T);
  }

  if (segments[0] === "alerts" && segments[1] && segments[2] === undefined) {
    const id = segments[1];
    const existing = db.getFirstSync<Record<string, unknown>>("SELECT * FROM alert_rules WHERE id = ?", [id]);
    if (!existing) return fail(404, "NOT_FOUND", "ไม่พบ Alert นี้");

    if (m === "PATCH") {
      const b = body as Record<string, unknown>;
      const sets: string[] = [];
      const vals: unknown[] = [];
      const fieldMap: Record<string, string> = {
        name: "name",
        type: "type",
        condition: "condition",
        targetPrice: "target_price",
        enabled: "enabled",
        oneTime: "one_time",
        cooldownMinutes: "cooldown_minutes",
        notificationMessage: "notification_message",
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in (b ?? {})) {
          sets.push(`${col} = ?`);
          const v = (b as Record<string, unknown>)[key];
          vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
        }
      }
      if (sets.length > 0) {
        vals.push(id);
        db.runSync(`UPDATE alert_rules SET ${sets.join(", ")} WHERE id = ?`, vals as SQLiteBindValue[]);
      }
      return ok({ updated: true } as unknown as T);
    }

    if (m === "DELETE") {
      db.runSync("DELETE FROM alert_rules WHERE id = ?", [id]);
      return ok({ deleted: true } as unknown as T);
    }
  }

  if (segments[0] === "alerts" && segments[1] && segments[2] === "actions" && m === "POST") {
    const id = segments[1];
    const b = body as { action?: string };
    const action = b?.action;
    if (!action || !["enable", "disable", "pause", "resume", "duplicate", "test"].includes(action)) {
      return fail(400, "BAD_REQUEST", "Invalid action");
    }
    const existing = db.getFirstSync<Record<string, unknown>>("SELECT * FROM alert_rules WHERE id = ?", [id]);
    if (!existing) return fail(404, "NOT_FOUND", "ไม่พบ Alert นี้");

    if (action === "enable" || action === "resume") {
      db.runSync("UPDATE alert_rules SET enabled = 1 WHERE id = ?", [id]);
    } else if (action === "disable" || action === "pause") {
      db.runSync("UPDATE alert_rules SET enabled = 0 WHERE id = ?", [id]);
    } else if (action === "duplicate") {
      const newId = uid("alr");
      db.runSync(
        `INSERT INTO alert_rules (id, asset_id, name, type, condition, target_price, enabled, one_time, cooldown_minutes, notification_message, created_at)
         SELECT ?, asset_id, name || ' (คัดลอก)', type, condition, target_price, 0, one_time, cooldown_minutes, notification_message, ?
         FROM alert_rules WHERE id = ?`,
        [newId, new Date().toISOString(), id],
      );
      return ok({ alert: { id: newId } } as unknown as T);
    } else if (action === "test") {
      const quote = quoteFor(String(existing.target_price ? "" : ""));
      void quote;
      recordNotification(null, "ทดสอบการแจ้งเตือน", `นี่คือการแจ้งเตือนทดสอบจากแอป (device-local)`, "SENT");
      return ok({ tested: true } as unknown as T);
    }
    return ok({ updated: true } as unknown as T);
  }

  // ---- history ----
  if (pathname === "/api/alert-history" && m === "GET") {
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? "20")));
    const rows = db.getAllSync<Record<string, unknown>>(
      "SELECT * FROM alert_events ORDER BY triggered_at DESC LIMIT ?",
      [pageSize],
    );
    const events = rows.map((row) => ({
      id: String(row.id),
      symbol: String(row.symbol),
      currentPrice: Number(row.current_price),
      targetPrice: Number(row.target_price),
      triggeredAt: String(row.triggered_at),
      status: String(row.status) as "TRIGGERED" | "FAILED",
      alertRule:
        db.getFirstSync<{ name: string }>(
          "SELECT name FROM alert_rules WHERE id = ?",
          [String(row.alert_rule_id)],
        ) ?? null,
    }));
    return ok({ events, page: 1, pageSize, total: events.length } as unknown as T);
  }

  if (pathname === "/api/notification-history" && m === "GET") {
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? "20")));
    const rows = db.getAllSync<Record<string, unknown>>(
      "SELECT * FROM notification_logs ORDER BY sent_at DESC LIMIT ?",
      [pageSize],
    );
    const logs = rows.map((row) => ({
      id: String(row.id),
      title: String(row.title),
      body: String(row.body),
      status: String(row.status) as "SENT" | "FAILED",
      errorMessage: (row.error_message as string | null) ?? null,
      sentAt: String(row.sent_at),
    }));
    return ok({ logs, page: 1, pageSize, total: logs.length } as unknown as T);
  }

  // ---- preferences ----
  if (pathname === "/api/notification-preferences") {
    if (m === "GET") {
      const row = db.getFirstSync<Record<string, unknown>>("SELECT * FROM notification_preferences WHERE id = 1")!;
      return ok({
        preferences: {
          pushEnabled: Boolean(row.push_enabled),
          entryEnabled: Boolean(row.entry_enabled),
          exitEnabled: Boolean(row.exit_enabled),
          customEnabled: Boolean(row.custom_enabled),
          defaultSoundId: (row.default_sound_id as string | null) ?? null,
          volume: Number(row.volume),
        },
      } as unknown as T);
    }
    if (m === "PATCH") {
      const b = body as Record<string, unknown>;
      const fieldMap: Record<string, string> = {
        pushEnabled: "push_enabled",
        entryEnabled: "entry_enabled",
        exitEnabled: "exit_enabled",
        customEnabled: "custom_enabled",
        defaultSoundId: "default_sound_id",
        volume: "volume",
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in (b ?? {})) {
          const v = (b as Record<string, unknown>)[key];
          const bind: SQLiteBindValue = typeof v === "boolean" ? (v ? 1 : 0) : (v as SQLiteBindValue);
          db.runSync(`UPDATE notification_preferences SET ${col} = ? WHERE id = 1`, [bind]);
        }
      }
      const row = db.getFirstSync<Record<string, unknown>>("SELECT * FROM notification_preferences WHERE id = 1")!;
      return ok({
        preferences: {
          pushEnabled: Boolean(row.push_enabled),
          entryEnabled: Boolean(row.entry_enabled),
          exitEnabled: Boolean(row.exit_enabled),
          customEnabled: Boolean(row.custom_enabled),
          defaultSoundId: (row.default_sound_id as string | null) ?? null,
          volume: Number(row.volume),
        },
      } as unknown as T);
    }
  }

  // ---- analysis ----
  if (pathname === "/api/analysis/settings") {
    if (m === "GET") {
      const s = getAnalysisSettings();
      return ok({ settings: s } as unknown as T);
    }
    if (m === "PATCH") {
      const b = body as Record<string, unknown>;
      const fieldMap: Record<string, string> = {
        enabled: "enabled",
        suggestOnCreate: "suggest_on_create",
        analyzeOnTrigger: "analyze_on_trigger",
        lookbackMinutes: "lookback_minutes",
        minSamples: "min_samples",
      };
      for (const [key, col] of Object.entries(fieldMap)) {
        if (key in (b ?? {})) {
          const v = (b as Record<string, unknown>)[key];
          const bind: SQLiteBindValue = typeof v === "boolean" ? (v ? 1 : 0) : (v as SQLiteBindValue);
          db.runSync(`UPDATE analysis_settings SET ${col} = ? WHERE id = 1`, [bind]);
        }
      }
      return ok({ settings: getAnalysisSettings() } as unknown as T);
    }
  }

  if (pathname === "/api/analysis/suggest-price" && m === "POST") {
    const b = body as { symbol?: string };
    const symbol = String(b?.symbol ?? "").toUpperCase();
    if (!symbol) return fail(400, "BAD_REQUEST", "ระบุ symbol ก่อน");
    const asset = findAssetBySymbol(symbol) ?? ensureAsset(symbol);
    const quote = quoteFor(symbol);
    const outcome = suggestEntryPrice(symbol, quote);
    if (!outcome.ok) return fail(400, "BAD_REQUEST", outcome.error);
    const r = outcome.result;
    return ok({
      suggestion: {
        engine: r.engine,
        verdict: r.verdict,
        suggestedEntryPrice: r.suggestedEntryPrice,
        suggestedStopPrice: r.suggestedStopPrice,
        suggestedTargetPrice: r.suggestedTargetPrice,
        confidence: r.confidence,
        horizonDays: r.horizonDays,
        rationale: r.rationale,
        indicators: r.indicators,
      },
    } as unknown as T);
  }

  if (pathname === "/api/analysis/history" && m === "GET") {
    const pageSize = Math.min(50, Math.max(1, Number(params.get("pageSize") ?? "20")));
    const rows = db.getAllSync<Record<string, unknown>>(
      "SELECT * FROM analyses ORDER BY created_at DESC LIMIT ?",
      [pageSize],
    );
    const analyses: AnalysisRow[] = rows.map((row) => ({
      id: String(row.id),
      assetId: String(row.asset_id),
      alertEventId: (row.alert_event_id as string | null) ?? null,
      symbol: String(row.symbol),
      kind: String(row.kind) as AnalysisRow["kind"],
      priceAtAnalysis: Number(row.price_at_analysis),
      engine: String(row.engine),
      verdict: (row.verdict as string | null) ?? null,
      suggestedEntryPrice: (row.suggested_entry_price as number | null) ?? null,
      suggestedStopPrice: (row.suggested_stop_price as number | null) ?? null,
      suggestedTargetPrice: (row.suggested_target_price as number | null) ?? null,
      confidence: (row.confidence as number | null) ?? null,
      horizonDays: (row.horizon_days as number | null) ?? null,
      rationale: (row.rationale as string | null) ?? null,
      ok: Boolean(row.ok),
      error: (row.error as string | null) ?? null,
      createdAt: String(row.created_at),
    }));
    return ok({ analyses, page: 1, pageSize, total: analyses.length } as unknown as T);
  }

  return null; // unknown path → caller decides fallback
}
