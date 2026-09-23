import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { requireUser } from "@/lib/api/handler";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
    const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize") ?? "20")));

    const [events, total] = await Promise.all([
      prisma.alertEvent.findMany({
        where: { userId: user.id },
        orderBy: { triggeredAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.alertEvent.count({ where: { userId: user.id } }),
    ]);

    return ok({ events, page, pageSize, total });
  } catch (err) {
    return toErrorResponse(err);
  }
}
