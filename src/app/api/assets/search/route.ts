import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser, ensureUserRateLimit } from "@/lib/api/handler";
import { getMarketDataProvider, withRetry } from "@/lib/market-data";
import type { AssetSearchResult } from "@/types/market";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    ensureUserRateLimit(user.id, "asset-search", 60, 60);

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 50);
    if (!q) return ok({ results: [] });

    const upper = q.toUpperCase();
    // SQLite: `contains` เป็น case-sensitive และไม่รองรับ mode: "insensitive" —
    // ครอบคลุมด้วยตัวแปรพบบ่อย (ต้นฉบับ / ขึ้นต้นด้วยตัวพิมพ์ใหญ่ / ตัวพิมพ์ใหญ่ทั้งคำ)
    const cap = q.charAt(0).toUpperCase() + q.slice(1);
    let results: AssetSearchResult[] = [];

    // 1) Local DB first (seeded + previously discovered assets).
    const local = await prisma.asset.findMany({
      where: {
        OR: [
          { symbol: { contains: upper } },
          { name: { contains: q } },
          { name: { contains: cap } },
          { name: { contains: upper } },
        ],
      },
      take: 15,
      orderBy: { symbol: "asc" },
    });
    if (local.length > 0) {
      results = local.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        exchange: a.exchange,
        type: a.type as AssetSearchResult["type"],
        currency: a.currency,
      }));
    }

    // 2) Provider fallback (merge, dedupe by symbol), tolerate provider failure.
    try {
      const providerResults = await withRetry(() => getMarketDataProvider().searchAssets(q), 2, 300);
      const seen = new Set(results.map((r) => r.symbol));
      for (const r of providerResults) {
        if (!seen.has(r.symbol)) {
          results.push(r);
          seen.add(r.symbol);
          // Cache discovered assets for future searches and alert creation.
          void prisma.asset
            .upsert({
              where: { symbol: r.symbol },
              update: { name: r.name, exchange: r.exchange, type: r.type },
              create: { symbol: r.symbol, name: r.name, exchange: r.exchange, type: r.type, currency: r.currency },
            })
            .catch(() => undefined);
        }
      }
    } catch {
      // Provider failure is non-fatal: local results are still returned.
    }

    return ok({ results: results.slice(0, 20) });
  } catch (err) {
    return toErrorResponse(err);
  }
}
