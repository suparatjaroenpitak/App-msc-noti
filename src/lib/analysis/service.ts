import { prisma } from "@/lib/db/prisma";
import { analyze, DISCLAIMER } from "./engine";
import type { EngineInput, EngineOutput } from "./engine";

export type { EngineOutput } from "./engine";

export interface AnalysisSettingsData {
  enabled: boolean;
  suggestOnCreate: boolean;
  analyzeOnTrigger: boolean;
  lookbackMinutes: number;
  minSamples: number;
}

export async function getAnalysisSettings(userId: string): Promise<AnalysisSettingsData> {
  const s = await prisma.analysisSettings.findUnique({ where: { userId } });
  if (s) {
    return {
      enabled: s.enabled,
      suggestOnCreate: s.suggestOnCreate,
      analyzeOnTrigger: s.analyzeOnTrigger,
      lookbackMinutes: s.lookbackMinutes,
      minSamples: s.minSamples,
    };
  }
  return { enabled: true, suggestOnCreate: true, analyzeOnTrigger: false, lookbackMinutes: 240, minSamples: 12 };
}

async function fetchRecentPrices(assetId: string, lookbackMinutes: number): Promise<number[]> {
  const since = new Date(Date.now() - lookbackMinutes * 60_000);
  const rows = await prisma.priceSample.findMany({
    where: { assetId, sampledAt: { gte: since } },
    orderBy: { sampledAt: "asc" },
    select: { price: true },
  });
  return rows.map((r) => r.price.toNumber());
}

export interface SuggestInput {
  userId: string;
  symbol: string;
  currentPrice: number;
  dayHigh?: number | null;
  dayLow?: number | null;
  previousClose?: number | null;
}

/** Run the built-in engine and persist the result. Never throws for engine errors. */
export async function suggestEntryPrice(input: SuggestInput): Promise<
  { ok: true; result: EngineOutput } | { ok: false; error: string }
> {
  const settings = await getAnalysisSettings(input.userId);
  if (!settings.enabled || !settings.suggestOnCreate) {
    return { ok: false, error: "ปิดใช้งานการวิเคราะห์อยู่ (Settings → การวิเคราะห์)" };
  }

  const started = Date.now();
  try {
    const asset = await prisma.asset.findUnique({ where: { symbol: input.symbol } });
    if (!asset) return { ok: false, error: "ไม่พบหุ้นนี้ในระบบ" };

    const recentPrices = await fetchRecentPrices(asset.id, settings.lookbackMinutes);

    const engineInput: EngineInput = {
      symbol: input.symbol,
      assetName: asset.name,
      assetType: asset.type,
      currentPrice: input.currentPrice,
      currency: "USD",
      recentPrices,
      dayHigh: input.dayHigh,
      dayLow: input.dayLow,
      previousClose: input.previousClose,
      lookbackMinutes: settings.lookbackMinutes,
      minSamples: settings.minSamples,
    };

    const result = analyze(engineInput);

    await prisma.analysis.create({
      data: {
        userId: input.userId,
        assetId: asset.id,
        symbol: input.symbol,
        kind: "SUGGEST_PRICE",
        priceAtAnalysis: input.currentPrice,
        engine: result.engine,
        verdict: result.verdict,
        suggestedEntryPrice: result.suggestedEntryPrice,
        suggestedStopPrice: result.suggestedStopPrice,
        suggestedTargetPrice: result.suggestedTargetPrice,
        confidence: result.confidence,
        horizonDays: result.horizonDays,
        rationale: result.rationale,
        indicators: result.indicators,
        ok: true,
        durationMs: result.durationMs,
      },
    });

    return { ok: true, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordFailure(input.userId, input.symbol, "SUGGEST_PRICE", input.currentPrice, message, started);
    return { ok: false, error: `วิเคราะห์ไม่สำเร็จ: ${message}` };
  }
}

export interface TriggerInput {
  userId: string;
  symbol: string;
  assetId: string;
  alertEventId: string;
  currentPrice: number;
  dayHigh?: number | null;
  dayLow?: number | null;
}

/**
 * Called by the worker right after an alert triggers (when analyzeOnTrigger is on).
 * Returns a short Thai summary for the push notification. Never throws.
 */
export async function analyzeTrigger(
  input: TriggerInput,
): Promise<{ summary: string; suggestedEntryPrice: number | null; verdict: string | null }> {
  try {
    const settings = await getAnalysisSettings(input.userId);
    if (!settings.enabled || !settings.analyzeOnTrigger) {
      return { summary: "", suggestedEntryPrice: null, verdict: null };
    }

    const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
    if (!asset) return { summary: "", suggestedEntryPrice: null, verdict: null };

    const recentPrices = await fetchRecentPrices(input.assetId, settings.lookbackMinutes);
    const result = analyze({
      symbol: asset.symbol,
      assetName: asset.name,
      assetType: asset.type,
      currentPrice: input.currentPrice,
      currency: "USD",
      recentPrices,
      dayHigh: input.dayHigh,
      dayLow: input.dayLow,
      lookbackMinutes: settings.lookbackMinutes,
      minSamples: settings.minSamples,
    });

    await prisma.analysis.create({
      data: {
        userId: input.userId,
        assetId: input.assetId,
        alertEventId: input.alertEventId,
        symbol: input.symbol,
        kind: "ON_TRIGGER",
        priceAtAnalysis: input.currentPrice,
        engine: result.engine,
        verdict: result.verdict,
        suggestedEntryPrice: result.suggestedEntryPrice,
        suggestedStopPrice: result.suggestedStopPrice,
        suggestedTargetPrice: result.suggestedTargetPrice,
        confidence: result.confidence,
        horizonDays: result.horizonDays,
        rationale: result.rationale,
        indicators: result.indicators,
        ok: true,
        durationMs: result.durationMs,
      },
    });

    const verdictText = result.verdict === "BUY" ? "น่าสนใจ" : result.verdict === "AVOID" ? "ควรเลี่ยงตอนนี้" : "ควรรอ";
    const summary = `${verdictText} · จุดเข้าแนะนำ ~$${result.suggestedEntryPrice.toFixed(2)} · จาก ${result.indicators.samples} จุดข้อมูล (${DISCLAIMER})`;
    return { summary, suggestedEntryPrice: result.suggestedEntryPrice, verdict: result.verdict };
  } catch {
    // Analysis must never break the alert pipeline.
    return { summary: "", suggestedEntryPrice: null, verdict: null };
  }
}

async function recordFailure(
  userId: string,
  symbol: string,
  kind: "SUGGEST_PRICE" | "ON_TRIGGER",
  price: number,
  error: string,
  started: number,
): Promise<void> {
  try {
    const asset = await prisma.asset.findUnique({ where: { symbol }, select: { id: true } });
    if (!asset) return;
    await prisma.analysis.create({
      data: {
        userId,
        assetId: asset.id,
        symbol,
        kind,
        priceAtAnalysis: price,
        ok: false,
        error: error.slice(0, 500),
        durationMs: Date.now() - started,
      },
    });
  } catch {
    /* logging never throws */
  }
}
