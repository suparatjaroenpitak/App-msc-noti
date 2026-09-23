import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";

/** POST /api/notification-sounds/:id/activate — set as the user's default sound. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { id } = await params;

    const sound = await prisma.notificationSound.findUnique({ where: { id } });
    if (!sound || sound.userId !== user.id) throw notFound("Sound");

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: { defaultSoundId: id },
      create: { userId: user.id, defaultSoundId: id },
    });
    return ok({ preferences: prefs });
  } catch (err) {
    return toErrorResponse(err);
  }
}
