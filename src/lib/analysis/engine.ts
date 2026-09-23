/**
 * Built-in analysis engine ("builtin-v1") — แอปวิเคราะห์เองจากตัวเลขราคา
 * ไม่มี dependency ภายนอก ไม่เรียก service อื่น (ปลอดภัย ทำงาน offline ได้)
 *
 * Indicators: SMA(5/20), momentum %, RSI(14), volatility (stdev %), range position.
 * Verdict rules are deterministic and conservative — เน้น "รอ" เป็นค่าเริ่มต้น
 * เพื่อไม่สื่อว่าเป็นคำแนะนำซื้อขาย (disclaimer แนบทุกผลลัพธ์)
 */

export interface EngineInput {
  symbol: string;
  assetName: string;
  assetType: "STOCK" | "ETF";
  currentPrice: number;
  currency: string;
  /** ราคาเก่า → ใหม่ (จาก PriceSample ของ worker) */
  recentPrices: number[];
  dayHigh?: number | null;
  dayLow?: number | null;
  previousClose?: number | null;
  lookbackMinutes?: number;
  minSamples?: number;
}

export interface EngineOutput {
  engine: string;
  verdict: "BUY" | "WAIT" | "AVOID";
  suggestedEntryPrice: number;
  suggestedStopPrice: number | null;
  suggestedTargetPrice: number | null;
  confidence: number;
  horizonDays: number;
  rationale: string;
  indicators: {
    samples: number;
    sma5: number | null;
    sma20: number | null;
    momentumPct: number;
    rsi14: number | null;
    volatilityPct: number;
    rangePositionPct: number | null;
  };
  durationMs: number;
}

export const DISCLAIMER = "ไม่ใช่คำแนะนำการลงทุน";

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function rsi(values: number[], period = 14): number | null {
  if (values.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = values.length - period; i < values.length; i++) {
    const diff = values[i]! - values[i - 1]!;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / period / (losses / period);
  return 100 - 100 / (1 + rs);
}

function stdevPct(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length - 1);
  return mean !== 0 ? (Math.sqrt(variance) / mean) * 100 : 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function analyze(input: EngineInput): EngineOutput {
  const started = Date.now();
  const prices = input.recentPrices.filter((p) => Number.isFinite(p) && p > 0);
  const all = prices.length > 0 ? [...prices, input.currentPrice] : [input.currentPrice];
  const minSamples = Math.max(2, input.minSamples ?? 12);

  const sma5 = sma(all, 5);
  const sma20 = sma(all, 20);
  const rsi14 = rsi(all, 14);
  const vol = stdevPct(all.slice(-30));

  // Momentum: เทียบราคาปัจจุบันกับค่าเฉลี่ยช่วงต้นของข้อมูลที่มี
  const lookback = Math.min(all.length, Math.max(6, Math.floor(all.length / 2)));
  const base = all.slice(0, lookback).reduce((a, b) => a + b, 0) / lookback;
  const momentumPct = base !== 0 ? ((input.currentPrice - base) / base) * 100 : 0;

  // ตำแหน่งในกรอบราคาที่เห็น (0 = จุดต่ำสุด, 100 = จุดสูงสุด)
  const lo = input.dayLow ?? Math.min(...all);
  const hi = input.dayHigh ?? Math.max(...all);
  const rangePositionPct = hi > lo ? ((input.currentPrice - lo) / (hi - lo)) * 100 : 50;

  // ---------- Verdict (deterministic, conservative) ----------
  const reasons: string[] = [];
  let score = 0;

  if (sma5 !== null && sma20 !== null) {
    if (sma5 > sma20) {
      score += 1;
      reasons.push("ราคาเฉลี่ยระยะสั้นสูงกว่าระยะกลาง (แนวโน้มดีขึ้น)");
    } else if (sma5 < sma20) {
      score -= 1;
      reasons.push("ราคาเฉลี่ยระยะสั้นต่ำกว่าระยะกลาง (แนวโน้มอ่อนแรง)");
    }
  }

  if (rsi14 !== null) {
    if (rsi14 < 30) {
      score += 1;
      reasons.push(`RSI ${rsi14.toFixed(0)} เข้าเขต oversold — ราคาถูกกว่าช่วงหลัง`);
    } else if (rsi14 > 70) {
      score -= 1;
      reasons.push(`RSI ${rsi14.toFixed(0)} เข้าเขต overbought — ระวังย่อ`);
    }
  }

  if (momentumPct <= -2) {
    score += 1;
    reasons.push(`โมเมนตัม ${momentumPct.toFixed(1)}% ต่ำกว่าค่าเฉลี่ยช่วงก่อน`);
  } else if (momentumPct >= 5) {
    score -= 1;
    reasons.push(`ราคาวิ่งขึ้นเร็ว (${momentumPct.toFixed(1)}%) — เสี่ยงเข้าจุดสูง`);
  }

  if (rangePositionPct <= 25 && input.dayLow != null) {
    score += 1;
    reasons.push("ราคาอยู่บริเวณใกล้จุดต่ำของกรอบวัน");
  } else if (rangePositionPct >= 85 && input.dayHigh != null) {
    score -= 1;
    reasons.push("ราคาใกล้จุดสูงของกรอบวัน");
  }

  const verdict: EngineOutput["verdict"] = score >= 2 ? "BUY" : score <= -2 ? "AVOID" : "WAIT";

  // ---------- ระดับราคาแนะนำ ----------
  const atrLike = Math.max(input.currentPrice * (vol / 100), input.currentPrice * 0.005); // อย่างน้อย 0.5%
  const entry = round2(input.currentPrice - atrLike * 0.5); // เข้าใต้ตลาดเล็กน้อย
  const stop = round2(entry - atrLike * 1.5);
  const target = round2(entry + atrLike * 2.5);

  // Confidence: ยิ่งข้อมูลเยอะ/คะแนนชัด ยิ่งมั่นใจ (cap ไว้ต่ำเพราะข้อมูลจำกัด)
  const dataScore = Math.min(1, all.length / 40); // 40 samples ≈ เต็มที่
  const conviction = Math.min(1, Math.abs(score) / 3);
  const confidence = round2(Math.max(0.1, Math.min(0.75, 0.25 + 0.35 * dataScore + 0.15 * conviction)) * 0.75);

  const horizonDays = verdict === "BUY" ? 14 : 7;

  const rationale =
    `สรุปจากข้อมูล ${all.length} จุด: ${reasons.length > 0 ? reasons.join(" · ") : "สัญญาณยังไม่ชัดเจน ควรรอข้อมูลสะสมเพิ่ม"}` +
    ` · ความผันผวน ${vol.toFixed(1)}% · ${DISCLAIMER}`;

  return {
    engine: "builtin-v1",
    verdict,
    suggestedEntryPrice: entry,
    suggestedStopPrice: stop,
    suggestedTargetPrice: target,
    confidence,
    horizonDays,
    rationale,
    indicators: {
      samples: all.length,
      sma5: sma5 !== null ? round2(sma5) : null,
      sma20: sma20 !== null ? round2(sma20) : null,
      momentumPct: round2(momentumPct),
      rsi14: rsi14 !== null ? round2(rsi14) : null,
      volatilityPct: round2(vol),
      rangePositionPct: round2(rangePositionPct),
    },
    durationMs: Date.now() - started,
  };
}
