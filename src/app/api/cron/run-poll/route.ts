import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { runPollCycle } from "@/worker/alert-engine";

/**
 * POST /api/cron/run-poll — triggers a single poll cycle.
 * Intended for serverless platforms (e.g. Vercel Cron) where no long-running
 * worker process exists. Protect with CRON_SECRET (Authorization: Bearer ...).
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return fail(503, "INTERNAL_ERROR", "CRON_SECRET is not configured; cron polling disabled");
    }
    const auth = req.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return fail(401, "UNAUTHORIZED", "Invalid cron secret");
    }

    const result = await runPollCycle();
    return ok({ ranAt: new Date().toISOString(), ...result });
  } catch (err) {
    return toErrorResponse(err);
  }
}
