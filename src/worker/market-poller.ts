import { prisma } from "@/lib/db/prisma";
import { getMarketDataProvider, isMarketOpen, withRetry } from "@/lib/market-data";
import type { StockQuote } from "@/types/market";

/**
 * Fetch quotes for every distinct symbol that has enabled alert rules.
 * Dedupes symbols, isolates errors per symbol, and stores a PriceSample row
 * per quote so the built-in analysis engine has rolling history to learn from.
 */
export async function pollActiveSymbols(options?: { force?: boolean }): Promise<Map<string, StockQuote>> {
  const rows = await prisma.alertRule.findMany({
    where: { enabled: true },
    select: { assetId: true, asset: { select: { symbol: true } } },
    distinct: ["assetId"],
  });

  const symbols = [...new Set(rows.map((r) => r.asset.symbol))];

  // Outside market hours only poll when explicitly forced (e.g. tests / manual runs).
  if (!options?.force && !isMarketOpen()) return new Map();

  const results = new Map<string, StockQuote>();
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        // Fresh price per cycle — alert decisions need the latest value.
        const quote = await withRetry(() => getMarketDataProvider().getQuote(symbol));
        results.set(symbol, quote);
      } catch (err) {
        console.error(`[worker] quote failed for ${symbol}:`, err instanceof Error ? err.message : err);
      }
    }),
  );

  // Persist samples (dedupe by (assetId, sampledAt)) — best effort, never fatal.
  await Promise.all(
    [...results.entries()].map(async ([symbol, quote]) => {
      try {
        const asset = await prisma.asset.findUnique({ where: { symbol }, select: { id: true } });
        if (!asset) return;
        const now = new Date();
        await prisma.priceSample.create({
          data: {
            assetId: asset.id,
            symbol,
            price: quote.price,
            volume: quote.volume != null ? Math.round(quote.volume) : null,
            sampledAt: now,
          },
        });
        // Retention: keep ~3 days of per-minute samples per asset.
        if (Math.random() < 0.05) {
          await prisma.priceSample.deleteMany({
            where: { assetId: asset.id, sampledAt: { lt: new Date(Date.now() - 3 * 24 * 3600_000) } },
          });
        }
      } catch (err) {
        console.error(`[worker] sample persist failed for ${symbol}:`, err instanceof Error ? err.message : err);
      }
    }),
  );

  return results;
}
