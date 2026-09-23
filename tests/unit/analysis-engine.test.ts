import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/analysis/engine";

const baseInput = {
  symbol: "QQQM",
  assetName: "Invesco NASDAQ 100 ETF",
  assetType: "ETF" as const,
  currency: "USD",
  currentPrice: 100,
  recentPrices: [] as number[],
};

describe("analysis engine (builtin-v1)", () => {
  it("returns WAIT when there is not enough data", () => {
    const out = analyze({ ...baseInput, recentPrices: [100, 100, 100] });
    expect(out.verdict).toBe("WAIT");
    expect(out.indicators.samples).toBe(4);
  });

  it("recommends BUY on strong bullish setup (uptrend + oversold + near day low)", () => {
    // Rising into a small dip: SMA5 > SMA20, RSI low, momentum negative, near day low
    const prices = [95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114];
    const out = analyze({
      ...baseInput,
      currentPrice: 100,
      recentPrices: prices,
      dayLow: 99,
      dayHigh: 114,
    });
    // SMA5 vs SMA20: recent 5 avg (110) vs 20 avg (~104.5) → up; momentum vs early avg (~104.5) → −4%;
    // RSI after drop from 114→100 → low; range position ≈ 7% (near low)
    expect(out.verdict).toBe("BUY");
    expect(out.suggestedEntryPrice).toBeLessThan(100);
    expect(out.suggestedStopPrice!).toBeLessThan(out.suggestedEntryPrice);
    expect(out.suggestedTargetPrice!).toBeGreaterThan(out.suggestedEntryPrice);
  });

  it("recommends AVOID on strong bearish setup (downtrend + overbought spike + near day high)", () => {
    // Falling trend, then a sharp late spike up
    const prices = [114, 113, 112, 111, 110, 109, 108, 107, 106, 105, 104, 103, 102, 101, 100, 99, 98, 97, 96, 95];
    const out = analyze({
      ...baseInput,
      currentPrice: 115,
      recentPrices: prices,
      dayLow: 95,
      dayHigh: 115,
    });
    // SMA5 (100) < SMA20 (~104) → down; price spiked +10% over early avg → momentum penalty; near day high
    expect(out.verdict).toBe("AVOID");
  });

  it("never lets entry price go below zero and rounds to 2 decimals", () => {
    const out = analyze({ ...baseInput, currentPrice: 1, recentPrices: [1, 1, 1, 1, 1, 1] });
    expect(out.suggestedEntryPrice).toBeGreaterThan(0);
    expect(Number.isInteger(out.suggestedEntryPrice * 100)).toBe(true);
  });

  it("computes confidence within [0.05, 0.75] and includes disclaimer", () => {
    const out = analyze({ ...baseInput, recentPrices: Array.from({ length: 40 }, (_, i) => 100 + i * 0.1) });
    expect(out.confidence).toBeGreaterThan(0);
    expect(out.confidence).toBeLessThanOrEqual(0.75);
    expect(out.rationale).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("filters invalid prices from history", () => {
    const out = analyze({ ...baseInput, recentPrices: [NaN, 0, -5, 100, 101, 102, 103, 104] as unknown as number[] });
    expect(out.indicators.samples).toBe(6); // 5 valid + current
  });
});
