import { describe, expect, it, vi } from "vitest";
import { getUsMarketStatus, withRetry, getCachedQuote, setMarketDataProviderForTests } from "@/lib/market-data";

describe("US market status", () => {
  it("is closed on weekends", () => {
    // 2026-09-26 is a Saturday
    const saturday = new Date("2026-09-26T15:00:00Z"); // 11:00 ET
    expect(getUsMarketStatus(saturday).state).toBe("CLOSED");
  });

  it("is open during 09:30–16:00 ET on a weekday", () => {
    const wednesday = new Date("2026-09-23T14:00:00Z"); // 10:00 ET (EDT)
    expect(getUsMarketStatus(wednesday).state).toBe("OPEN");
  });

  it("detects pre-market", () => {
    const wednesday = new Date("2026-09-23T12:00:00Z"); // 08:00 ET
    expect(getUsMarketStatus(wednesday).state).toBe("PRE");
  });
});

describe("withRetry", () => {
  it("retries and eventually succeeds", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("flaky");
        return "ok";
      },
      3,
      1,
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("throws after exhausting attempts", async () => {
    await expect(withRetry(async () => { throw new Error("always"); }, 2, 1)).rejects.toThrow("always");
  });
});

describe("getCachedQuote", () => {
  it("caches provider calls within TTL", async () => {
    const getQuote = vi.fn(async () => ({
      symbol: "TEST", price: 10, change: 0, changePercent: 0,
      dayHigh: 10, dayLow: 10, previousClose: 10, volume: 0, currency: "USD", timestamp: Date.now(),
    }));
    setMarketDataProviderForTests({ getQuote, searchAssets: async () => [] });

    await getCachedQuote("TSTCACHE"); // unique symbol to avoid cache collision
    await getCachedQuote("TSTCACHE");
    expect(getQuote).toHaveBeenCalledTimes(1);
  });
});
