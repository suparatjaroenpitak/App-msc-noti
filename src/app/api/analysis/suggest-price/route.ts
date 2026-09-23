import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { requireUser, assertSameOrigin, ensureUserRateLimit } from "@/lib/api/handler";
import { suggestEntryPrice } from "@/lib/analysis/service";
import { getCachedQuote } from "@/lib/market-data";
import { z } from "zod";

const schema = z.object({
  symbol: z.string().trim().toUpperCase().min(1).max(10),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    ensureUserRateLimit(user.id, "analysis-suggest", 60, 3600); // cheap — 60/hour

    const { symbol } = schema.parse(await req.json());
    const quote = await getCachedQuote(symbol);

    const outcome = await suggestEntryPrice({
      userId: user.id,
      symbol,
      currentPrice: quote.price,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      previousClose: quote.previousClose,
    });

    if (!outcome.ok) return fail(400, "BAD_REQUEST", outcome.error);

    const { result } = outcome;
    return ok({
      suggestion: {
        engine: result.engine,
        verdict: result.verdict,
        suggestedEntryPrice: result.suggestedEntryPrice,
        suggestedStopPrice: result.suggestedStopPrice,
        suggestedTargetPrice: result.suggestedTargetPrice,
        confidence: result.confidence,
        horizonDays: result.horizonDays,
        rationale: result.rationale,
        indicators: result.indicators,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
