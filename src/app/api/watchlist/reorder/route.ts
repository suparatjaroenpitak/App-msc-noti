import { requireUser } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, badRequest } from "@/lib/api/response";
import { reorderWatchlistSchema } from "@/lib/validation/schemas";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const { items } = reorderWatchlistSchema.parse(await req.json());

    // Verify all ids belong to this user before updating.
    const owned = await prisma.watchlistItem.findMany({
      where: { id: { in: items }, userId: user.id },
      select: { id: true },
    });
    if (owned.length !== items.length) {
      throw badRequest("Some items do not belong to your watchlist");
    }

    await prisma.$transaction(
      items.map((id, index) => prisma.watchlistItem.update({ where: { id }, data: { sortOrder: index + 1 } })),
    );

    return ok({ reordered: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
