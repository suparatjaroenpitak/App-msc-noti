import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
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
