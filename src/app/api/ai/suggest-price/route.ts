import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { requireUser, assertSameOrigin, ensureUserRateLimit } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { suggestEntryPrice } from "@/lib/ai/analysis";
import { getCachedQuote } from "@/lib/market-data";
import { z } from "zod";

const schema = z.object({
  symbol: z.string().trim().toUpperCase().min(1).max(10),
  recentPrices: z.array(z.number().positive()).max(60).optional(),
});

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    ensureUserRateLimit(user.id, "ai-suggest", 10, 3600); // AI calls are expensive — 10/hour

    const { symbol, recentPrices } = schema.parse(await req.json());

    const settings = await prisma.aiSettings.findUnique({ where: { userId: user.id } });
    if (!settings || !settings.enabled) return fail(400, "BAD_REQUEST", "ยังไม่ได้เปิดใช้ AI ในหน้า Settings → AI");
    if (!settings.suggestOnCreate) return fail(400, "BAD_REQUEST", "ปิดใช้งานการแนะนำราคาอัตโนมัติอยู่ (Settings → AI)");

    const asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) return fail(404, "NOT_FOUND", "ไม่พบหุ้นนี้");

    const quote = await getCachedQuote(symbol);

    const result = await suggestEntryPrice({
      userId: user.id,
      symbol,
      assetName: asset.name,
      assetType: asset.type,
      currentPrice: quote.price,
      currency: quote.currency || "USD",
      recentPrices,
      dayHigh: quote.dayHigh,
      dayLow: quote.dayLow,
      previousClose: quote.previousClose,
      cooldownMinutes: 60,
    });

    return ok({
      suggestion: {
        suggestedEntryPrice: result.suggestedEntryPrice,
        suggestedStopPrice: result.suggestedStopPrice,
        suggestedTargetPrice: result.suggestedTargetPrice,
        confidence: result.confidence,
        horizonDays: result.horizonDays,
        verdict: result.verdict,
        rationale: result.rationale,
        model: result.model,
        durationMs: result.durationMs,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
