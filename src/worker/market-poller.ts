import { prisma } from "@/lib/db/prisma";
import { getCachedQuote, isMarketOpen } from "@/lib/market-data";

export interface PolledQuote {
  symbol: string;
  price: number;
}

/**
 * Fetch quotes for every distinct symbol that has enabled alert rules.
 * Dedupes symbols so one API call serves many rules; isolates errors per symbol.
 */
export async function pollActiveSymbols(options?: { force?: boolean }): Promise<Map<string, number>> {
  const rows = await prisma.alertRule.findMany({
    where: { enabled: true },
    select: { asset: { select: { symbol: true } } },
    distinct: ["assetId"],
  });

  const symbols = [...new Set(rows.map((r) => r.asset.symbol))];

  // Outside market hours only poll when explicitly forced (e.g. tests).
  if (!options?.force && !isMarketOpen()) {
    return new Map();
  }

  const results = new Map<string, number>();
  await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const quote = await getCachedQuote(symbol); // getCachedQuote already retries
        results.set(symbol, quote.price);
      } catch (err) {
        // Error isolation per symbol: one bad symbol must not break the cycle.
        console.error(`[worker] quote failed for ${symbol}:`, err instanceof Error ? err.message : err);
      }
    }),
  );
  return results;
}
