import { requireUser } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound } from "@/lib/api/response";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(req);
    const { id } = await params;

    // Ownership validation — prevents IDOR.
    const item = await prisma.watchlistItem.findUnique({ where: { id } });
    if (!item || item.userId !== user.id) throw notFound("Watchlist item");

    await prisma.watchlistItem.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
