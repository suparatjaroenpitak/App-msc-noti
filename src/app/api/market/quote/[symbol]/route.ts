import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser, ensureUserRateLimit } from "@/lib/api/handler";
import { getCachedQuote } from "@/lib/market-data";

export async function GET(req: Request, { params }: { params: Promise<{ symbol: string }> }) {
  try {
    const user = await requireUser(req);
    ensureUserRateLimit(user.id, "quote", 120, 60);

    const { symbol } = await params;
    const quote = await getCachedQuote(symbol.toUpperCase());
    return ok({ quote });
  } catch (err) {
    return toErrorResponse(err);
  }
}
