import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound, conflict } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { addToWatchlistSchema } from "@/lib/validation/schemas";
import { getCachedQuote } from "@/lib/market-data";

/** GET /api/watchlist — items with latest quote + per-asset alert count, sorted. */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const items = await prisma.watchlistItem.findMany({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
      include: {
        asset: {
          include: {
            _count: { select: { alertRules: { where: { userId: user.id } } } },
          },
        },
      },
    });

    const itemsWithQuotes = await Promise.all(
      items.map(async (item) => {
        try {
          const quote = await getCachedQuote(item.asset.symbol);
          return {
            id: item.id,
            symbol: item.asset.symbol,
            name: item.asset.name,
            exchange: item.asset.exchange,
            type: item.asset.type,
            currency: item.asset.currency,
            sortOrder: item.sortOrder,
            alertCount: item.asset._count.alertRules,
            quote: { price: quote.price, change: quote.change, changePercent: quote.changePercent, currency: quote.currency },
          };
        } catch {
          // Keep the item visible even if the provider fails for this symbol.
          return {
            id: item.id, symbol: item.asset.symbol, name: item.asset.name, exchange: item.asset.exchange,
            type: item.asset.type, currency: item.asset.currency, sortOrder: item.sortOrder,
            alertCount: item.asset._count.alertRules, quote: null,
          };
        }
      }),
    );

    return ok({ items: itemsWithQuotes });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** POST /api/watchlist — add an asset by symbol (creates the asset row if new). */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { symbol } = addToWatchlistSchema.parse(await req.json());

    let asset = await prisma.asset.findUnique({ where: { symbol } });
    if (!asset) {
      // Validate the symbol against the provider before persisting.
      try {
        const quote = await getCachedQuote(symbol);
        asset = await prisma.asset.create({
          data: {
            symbol,
            name: quote.symbol === symbol ? symbol : quote.symbol,
            exchange: "US",
            type: "STOCK",
            currency: quote.currency || "USD",
          },
        });
      } catch {
        throw notFound(`Symbol ${symbol}`);
      }
    }

    const exists = await prisma.watchlistItem.findUnique({
      where: { userId_assetId: { userId: user.id, assetId: asset.id } },
    });
    if (exists) throw conflict("Already in your watchlist");

    const maxOrder = await prisma.watchlistItem.aggregate({ where: { userId: user.id }, _max: { sortOrder: true } });
    const item = await prisma.watchlistItem.create({
      data: { userId: user.id, assetId: asset.id, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
      include: { asset: true },
    });

    return ok({ item: { id: item.id, symbol: item.asset.symbol, name: item.asset.name } }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
