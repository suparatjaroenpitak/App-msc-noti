import { prisma } from "@/lib/db/prisma";
import { ollama } from "./client";
import type { AiVerdict } from "@prisma/client";

export interface AiSettingsData {
  id: string;
  userId: string;
  enabled: boolean;
  analyzeOnTrigger: boolean;
  suggestOnCreate: boolean;
  baseUrl: string;
  model: string;
  timeoutSeconds: number;
  temperature: number;
}

/** Get the user's AI settings (never auto-creates with secrets; defaults are disabled). */
export async function getAiSettings(userId: string): Promise<AiSettingsData | null> {
  return prisma.aiSettings.findUnique({ where: { userId } });
}

export interface SuggestPriceInput {
  userId: string;
  symbol: string;
  assetName: string;
  assetType: "STOCK" | "ETF";
  currentPrice: number;
  currency: string;
  recentPrices?: number[];
  dayHigh?: number | null;
  dayLow?: number | null;
  previousClose?: number | null;
  cooldownMinutes?: number;
}

export interface SuggestPriceResult {
  suggestedEntryPrice: number;
  suggestedStopPrice: number | null;
  suggestedTargetPrice: number | null;
  confidence: number | null;
  horizonDays: number | null;
  verdict: "BUY" | "WAIT" | "AVOID" | null;
  rationale: string | null;
  model: string;
  durationMs: number;
}

const SYSTEM_RULES = `คุณเป็นผู้ช่วยวิเคราะห์ราคาหุ้น/ETF ที่ทำงานกับระบบแจ้งเตือนราคา
ตอบเป็น JSON ตาม schema นี้เท่านั้น (ห้ามใส่ข้อความอื่น):
{"suggestedEntryPrice": number, "suggestedStopPrice": number|null, "suggestedTargetPrice": number|null, "confidence": number (0-1)|null, "horizonDays": number|null, "verdict": "BUY"|"WAIT"|"AVOID", "rationale": string (ภาษาไทย ไม่เกิน 400 ตัวอักษร)}
กติกา:
- ใช้เฉพาะข้อมูลที่ผู้ใช้ให้ ไม่ใช้ข้อมูลภายนอก
- suggestedEntryPrice ต้องเป็นราคาแนะนำจุดเข้าใหม่ที่สมเหตุสมผล (ใกล้ราคาปัจจุบัน ±8%)
- ถ้าข้อมูลไม่พอ ให้ verdict = "WAIT" และให้ entry ใกล้ราคาปัจจุบัน
- rationale ต้องมี disclaimer ว่าไม่ใช่คำแนะนำการลงทุน`;

function buildSuggestPrompt(input: SuggestPriceInput): string {
  const recent = input.recentPrices?.length
    ? `\nราคาล่าสุด (เก่า→ใหม่): ${input.recentPrices.slice(-12).map((p) => p.toFixed(2)).join(", ")}`
    : "";
  return `วิเคราะห์จุดเข้าสำหรับ ${input.assetType} "${input.symbol}" (${input.assetName})
ราคาปัจจุบัน: ${input.currentPrice.toFixed(2)} ${input.currency}
${input.dayHigh ? `Day High: ${input.dayHigh.toFixed(2)}\n` : ""}${input.dayLow ? `Day Low: ${input.dayLow.toFixed(2)}\n` : ""}${input.previousClose ? `Previous Close: ${input.previousClose.toFixed(2)}\n` : ""}${recent}
Cooldown ที่ระบบรองรับ: ทุก ${input.cooldownMinutes ?? 60} นาที

ให้ผล JSON: suggestedEntryPrice (จุดเข้าแนะนำ), suggestedStopPrice, suggestedTargetPrice, confidence (0-1), horizonDays, verdict (BUY/WAIT/AVOID), rationale (ไทย สั้น มี disclaimer)`;
}

/** Parse the model's JSON reply leniently (models sometimes wrap or pad). */
function parseSuggestion(raw: string): Omit<SuggestPriceResult, "model" | "durationMs"> {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("AI ตอบกลับไม่ใช่ JSON");
    obj = JSON.parse(m[0]) as Record<string, unknown>;
  }

  const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) ? n : null;
  };

  const entry = num(obj.suggestedEntryPrice);
  if (entry === null || entry <= 0) throw new Error("AI ไม่ได้ราคา entry ที่ใช้ได้");

  const verdictRaw = String(obj.verdict ?? "").toUpperCase();
  const verdict: SuggestPriceResult["verdict"] =
    verdictRaw === "BUY" || verdictRaw === "WAIT" || verdictRaw === "AVOID" ? (verdictRaw as AiVerdict) : null;

  return {
    suggestedEntryPrice: entry,
    suggestedStopPrice: num(obj.suggestedStopPrice),
    suggestedTargetPrice: num(obj.suggestedTargetPrice),
    confidence: num(obj.confidence),
    horizonDays: num(obj.horizonDays) !== null ? Math.round(num(obj.horizonDays)!) : null,
    verdict: verdict as AiVerdict | null,
    rationale: typeof obj.rationale === "string" ? obj.rationale.slice(0, 800) : null,
  };
}

/** Ask the user's Ollama (on Colab) for an entry-price suggestion. Throws on failure. */
export async function suggestEntryPrice(input: SuggestPriceInput): Promise<SuggestPriceResult> {
  const settings = await getAiSettings(input.userId);
  if (!settings || !settings.enabled) {
    throw new Error("ยังไม่ได้เปิดใช้ AI ในหน้า Settings → AI");
  }

  const started = Date.now();
  let raw = "";
  try {
    raw = await ollama.generate(settings.baseUrl, settings.model, buildSuggestPrompt(input), {
      temperature: settings.temperature,
      timeoutMs: settings.timeoutSeconds * 1000,
    });
    const parsed = parseSuggestion(raw);
    const result: SuggestPriceResult = { ...parsed, model: settings.model, durationMs: Date.now() - started };

    // Persist (best effort) — useful for history and the asset page card.
    const asset = await prisma.asset.findUnique({ where: { symbol: input.symbol }, select: { id: true } });
    if (asset) {
      await prisma.aiAnalysis.create({
        data: {
          userId: input.userId,
          assetId: asset.id,
          symbol: input.symbol,
          kind: "SUGGEST_PRICE",
          priceAtAnalysis: input.currentPrice,
          model: settings.model,
          verdict: parsed.verdict,
          suggestedEntryPrice: parsed.suggestedEntryPrice,
          suggestedStopPrice: parsed.suggestedStopPrice,
          suggestedTargetPrice: parsed.suggestedTargetPrice,
          confidence: parsed.confidence,
          horizonDays: parsed.horizonDays,
          rationale: parsed.rationale,
          rawResponse: raw.slice(0, 4000),
          ok: true,
          durationMs: result.durationMs,
        },
      });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordFailedAnalysis(input.userId, input.symbol, "SUGGEST_PRICE", input.currentPrice, settings?.model ?? "?", message);
    throw new Error(`AI วิเคราะห์ไม่สำเร็จ: ${message}`);
  }
}

export interface TriggerAnalysisInput {
  userId: string;
  symbol: string;
  assetId: string;
  alertRuleId: string;
  alertEventId: string;
  assetName: string;
  assetType: "STOCK" | "ETF";
  currentPrice: number;
  targetPrice: number;
  condition: string;
  currency: string;
}

/**
 * Called by the worker when an alert triggers and analyzeOnTrigger is enabled.
 * Returns a short Thai summary + suggested next action to append to the push.
 */
export async function analyzeTrigger(input: TriggerAnalysisInput): Promise<{ summary: string; suggestedEntryPrice: number | null; verdict: AiVerdict | null; model: string }> {
  const settings = await getAiSettings(input.userId);
  if (!settings || !settings.enabled) {
    return { summary: "", suggestedEntryPrice: null, verdict: null, model: "" };
  }

  const started = Date.now();
  const prompt = `Alert เพิ่ง trigger สำหรับ ${input.assetType} "${input.symbol}" (${input.assetName})
ราคาปัจจุบัน: ${input.currentPrice.toFixed(2)} ${input.currency} | เงื่อนไข: ราคา${input.condition === "ABOVE_OR_EQUAL" ? " ≥ " : " ≤ "}${input.targetPrice.toFixed(2)}
ผู้ใช้ตั้งเป้าไว้แล้ว จงวิเคราะห์ว่าควรทำอย่างไรต่อ (ถือ/เข้าเพิ่ม/รอ/หลีก) พร้อมจุดเข้าใหม่ถ้าเหมาะสม
ตอบ JSON: {"summary": string (ไทย ไม่เกิน 220 ตัวอักษร, มี disclaimer สั้น ๆ), "suggestedEntryPrice": number|null, "verdict": "BUY"|"WAIT"|"AVOID"}`;

  try {
    const raw = await ollama.generate(settings.baseUrl, settings.model, prompt, {
      temperature: settings.temperature,
      timeoutMs: settings.timeoutSeconds * 1000,
    });
    const parsed = parseSuggestion(raw);
    const summary = String((JSON.parse(raw) as { summary?: string }).summary ?? "").slice(0, 400) || parsed.rationale || "";
    const suggestedEntryPrice = parsed.suggestedEntryPrice;
    const durationMs = Date.now() - started;

    await prisma.aiAnalysis.create({
      data: {
        userId: input.userId,
        assetId: input.assetId,
        alertEventId: input.alertEventId,
        symbol: input.symbol,
        kind: "ON_TRIGGER",
        priceAtAnalysis: input.currentPrice,
        model: settings.model,
        verdict: parsed.verdict,
        suggestedEntryPrice: parsed.suggestedEntryPrice,
        suggestedStopPrice: parsed.suggestedStopPrice,
        suggestedTargetPrice: parsed.suggestedTargetPrice,
        confidence: parsed.confidence,
        horizonDays: parsed.horizonDays,
        rationale: summary,
        rawResponse: raw.slice(0, 4000),
        ok: true,
        durationMs,
      },
    });

    return { summary, suggestedEntryPrice, verdict: parsed.verdict, model: settings.model };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordFailedAnalysis(input.userId, input.symbol, "ON_TRIGGER", input.currentPrice, settings.model, message, input.assetId, input.alertEventId);
    // Never fail the alert pipeline because of AI errors.
    return { summary: "", suggestedEntryPrice: null, verdict: null, model: settings.model };
  }
}

async function recordFailedAnalysis(
  userId: string,
  symbol: string,
  kind: "SUGGEST_PRICE" | "ON_TRIGGER",
  price: number,
  model: string,
  error: string,
  assetId?: string,
  alertEventId?: string,
): Promise<void> {
  try {
    const asset = assetId ? { id: assetId } : await prisma.asset.findUnique({ where: { symbol }, select: { id: true } });
    if (!asset) return;
    await prisma.aiAnalysis.create({
      data: {
        userId,
        assetId: asset.id,
        alertEventId: alertEventId ?? null,
        symbol,
        kind,
        priceAtAnalysis: price,
        model,
        ok: false,
        error: error.slice(0, 500),
      },
    });
  } catch {
    /* logging must never throw */
  }
}
