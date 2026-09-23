import { ok, toErrorResponse } from "@/lib/api/response";
import { prisma } from "@/lib/db/prisma";
import { isPushConfigured } from "@/lib/push/web-push";
import { getMarketDataProvider, getUsMarketStatus } from "@/lib/market-data";

export async function GET() {
  try {
    let dbOk = true;
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    let providerOk = true;
    let providerName = process.env.MARKET_DATA_PROVIDER ?? "mock";
    try {
      await getMarketDataProvider().searchAssets("AAPL");
    } catch {
      providerOk = false;
    }

    const market = getUsMarketStatus();

    return ok({
      db: dbOk,
      pushConfigured: isPushConfigured(),
      marketDataProvider: providerName,
      marketDataProviderHealthy: providerOk,
      market,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
