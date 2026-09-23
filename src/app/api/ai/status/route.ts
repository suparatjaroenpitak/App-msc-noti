import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { requireUser } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { ollama } from "@/lib/ai/client";

/** POST /api/ai/status { baseUrl } — check Ollama connectivity and list available models. */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as { baseUrl?: string };

    let baseUrl = body.baseUrl?.trim() ?? "";
    if (!baseUrl) {
      const settings = await prisma.aiSettings.findUnique({ where: { userId: user.id } });
      baseUrl = settings?.baseUrl ?? "";
    }
    if (!baseUrl) return fail(400, "BAD_REQUEST", "กรุณากรอก Base URL ของ Ollama (tunnel) ก่อน");

    const models = await ollama.listModels(baseUrl, 10_000);
    return ok({ connected: true, models });
  } catch (err) {
    return toErrorResponse(err);
  }
}
