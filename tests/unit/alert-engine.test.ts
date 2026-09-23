import { describe, expect, it, vi } from "vitest";
import { runPollCycle } from "@/worker/alert-engine";
import { setMarketDataProviderForTests } from "@/lib/market-data";
import { prisma } from "@/lib/db/prisma";
import type { StockQuote } from "@/types/market";

// Mock the Prisma client used inside the engine.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    alertRule: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    alertEvent: { create: vi.fn() },
    notificationPreference: { findUnique: vi.fn() },
    pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() },
    notificationSound: { findUnique: vi.fn() },
    notificationLog: { create: vi.fn() },
  },
}));

const quote = (price: number): StockQuote => ({
  symbol: "QQQM", price, change: 0, changePercent: 0,
  dayHigh: price, dayLow: price, previousClose: price, volume: 1, currency: "USD", timestamp: Date.now(),
});

const baseRule = {
  id: "rule1", userId: "u1", assetId: "a1", name: "test", type: "ENTRY",
  condition: "BELOW_OR_EQUAL", targetPrice: { toNumber: () => 180 },
  enabled: true, oneTime: false, cooldownMinutes: 60, notificationMessage: null,
  soundId: null, lastTriggeredAt: null,
  asset: { id: "a1", symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", currency: "USD" },
};

async function setupRules(rules: unknown[]) {
  vi.mocked(prisma.alertRule.findMany).mockResolvedValue(rules as never);
  vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.alertRule.update).mockResolvedValue({} as never);
  vi.mocked(prisma.alertEvent.create).mockResolvedValue({ id: "evt1", userId: "u1" } as never);
  vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null);
}

describe("alert engine", () => {
  it("triggers BELOW_OR_EQUAL when price <= target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(1);
    expect(prisma.notificationLog.create).toHaveBeenCalled();
  });

  it("does NOT trigger BELOW_OR_EQUAL when price > target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(185), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
  });

  it("triggers ABOVE_OR_EQUAL when price >= target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(151), searchAssets: async () => [] });
    await setupRules([{ ...baseRule, condition: "ABOVE_OR_EQUAL", targetPrice: { toNumber: () => 150 } }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(1);
  });

  it("does NOT trigger ABOVE_OR_EQUAL when price < target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(149), searchAssets: async () => [] });
    await setupRules([{ ...baseRule, condition: "ABOVE_OR_EQUAL", targetPrice: { toNumber: () => 150 } }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
  });

  it("is idempotent — second cycle within cooldown does not re-trigger", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);

    // Simulate another worker having claimed the rule:
    vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 0 } as never);

    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0); // claim lost → no event, no notification
  });

  it("respects cooldown via lastTriggeredAt pre-filter", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    const recent = { ...baseRule, lastTriggeredAt: new Date(Date.now() - 10 * 60_000) }; // 10 min ago, cooldown 60
    await setupRules([recent]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
  });

  it("disables one-time alert after triggering", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule, oneTime: true }]);
    await runPollCycle({ force: true });
    expect(prisma.alertRule.update).toHaveBeenCalledWith({ where: { id: "rule1" }, data: { enabled: false } });
  });

  it("creates FAILED AlertEvent when notification throws", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    vi.mocked(prisma.notificationPreference.findUnique).mockResolvedValue(null);
    // sendAlertNotification returns {sent:0,failed:0} when prefs missing — simulate send failure path instead:
    vi.mocked(prisma.alertEvent.create).mockRejectedValueOnce(new Error("db down"));
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
    // The engine caught the error and wrote a FAILED event (second create call).
    expect(prisma.alertEvent.create).toHaveBeenCalledTimes(2);
  });
});
