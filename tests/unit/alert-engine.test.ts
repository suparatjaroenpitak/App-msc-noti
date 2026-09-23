import { beforeEach, describe, expect, it, vi } from "vitest";
import { runPollCycle } from "@/worker/alert-engine";
import { setMarketDataProviderForTests } from "@/lib/market-data";
import { prisma } from "@/lib/db/prisma";
import type { StockQuote } from "@/types/market";

// Mock the Prisma client used by BOTH the engine and the notification sender.
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    alertRule: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn().mockResolvedValue(null), // sender's soundId lookup
    },
    alertEvent: { create: vi.fn() },
    notificationPreference: {
      findUnique: vi.fn().mockResolvedValue({
        pushEnabled: true, entryEnabled: true, exitEnabled: true, customEnabled: true, defaultSoundId: null,
      }),
    },
    pushSubscription: {
      findMany: vi.fn().mockResolvedValue([{ id: "sub1", endpoint: "https://push.example/1", p256dh: "k", auth: "a" }]),
    },
    notificationSound: { findUnique: vi.fn() },
    analysisSettings: { findUnique: vi.fn().mockResolvedValue(null) },
    priceSample: { create: vi.fn(), deleteMany: vi.fn() },
    asset: { findUnique: vi.fn().mockResolvedValue(null) },
    notificationLog: { create: vi.fn().mockResolvedValue({}) },
  },
}));

const quote = (price: number): StockQuote => ({
  symbol: "QQQM", price, change: 0, changePercent: 0,
  dayHigh: price, dayLow: price, previousClose: price, volume: 1, currency: "USD", timestamp: Date.now(),
});

const baseRule = {
  id: "rule1", userId: "u1", assetId: "a1", name: "test", type: "ENTRY",
  condition: "BELOW_OR_EQUAL", targetPrice: 180,
  enabled: true, oneTime: false, cooldownMinutes: 60, notificationMessage: null,
  soundId: null, lastTriggeredAt: null,
  asset: { id: "a1", symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", currency: "USD" },
};

async function setupRules(rules: unknown[]) {
  vi.mocked(prisma.alertRule.findMany).mockResolvedValue(rules as never);
  vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 1 } as never);
  vi.mocked(prisma.alertRule.update).mockResolvedValue({} as never);
  vi.mocked(prisma.alertEvent.create).mockResolvedValue({ id: "evt1", userId: "u1" } as never);
}

describe("alert engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("triggers BELOW_OR_EQUAL when price <= target and logs a notification attempt", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(1);
    // One subscription → one NotificationLog (status depends on VAPID availability).
    expect(prisma.notificationLog.create).toHaveBeenCalledTimes(1);
  });

  it("does NOT trigger BELOW_OR_EQUAL when price > target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(185), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
  });

  it("triggers ABOVE_OR_EQUAL when price >= target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(151), searchAssets: async () => [] });
    await setupRules([{ ...baseRule, condition: "ABOVE_OR_EQUAL", targetPrice: 150 }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(1);
  });

  it("does NOT trigger ABOVE_OR_EQUAL when price < target", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(149), searchAssets: async () => [] });
    await setupRules([{ ...baseRule, condition: "ABOVE_OR_EQUAL", targetPrice: 150 }]);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
  });

  it("is idempotent — when another worker claims the rule, nothing is sent", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    vi.mocked(prisma.alertRule.updateMany).mockResolvedValue({ count: 0 } as never);
    const result = await runPollCycle({ force: true });
    expect(result.alertsTriggered).toBe(0);
    expect(prisma.alertEvent.create).not.toHaveBeenCalled();
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

  it("records a FAILED AlertEvent when event creation throws, without crashing the cycle", async () => {
    setMarketDataProviderForTests({ getQuote: async () => quote(179), searchAssets: async () => [] });
    await setupRules([{ ...baseRule }]);
    vi.mocked(prisma.alertEvent.create).mockRejectedValueOnce(new Error("db down"));
    const result = await runPollCycle({ force: true });
    // The rule was claimed, but event creation failed → FAILED event is written as well.
    expect(result.alertsTriggered).toBe(1);
    expect(prisma.alertEvent.create).toHaveBeenCalledTimes(2); // TRIGGERED attempt + FAILED record
  });
});
