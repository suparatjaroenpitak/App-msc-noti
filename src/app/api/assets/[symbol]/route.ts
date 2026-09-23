import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound } from "@/lib/api/response";
import { requireUser } from "@/lib/api/handler";
import { getCachedQuote } from "@/lib/market-data";

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    await requireUser(req);
    const { symbol } = await params;
    const upper = symbol.toUpperCase();

    const asset = await prisma.asset.findUnique({ where: { symbol: upper } });
    if (!asset) throw notFound("Asset");

    const quote = await getCachedQuote(upper);
    return ok({
      asset: { id: asset.id, symbol: asset.symbol, name: asset.name, exchange: asset.exchange, type: asset.type, currency: asset.currency },
      quote,
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
