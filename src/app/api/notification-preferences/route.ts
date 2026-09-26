import { requireUser } from "@/lib/api/handler";
import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse } from "@/lib/api/response";
import { notificationPreferencesSchema } from "@/lib/validation/schemas";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });
    return ok({ preferences: prefs });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const input = notificationPreferencesSchema.parse(await req.json());

    // Validate sound ownership if provided.
    if (input.defaultSoundId) {
      const sound = await prisma.notificationSound.findUnique({ where: { id: input.defaultSoundId } });
      if (!sound || sound.userId !== user.id) {
        const e = new Error("Sound not found"); (e as { status?: number }).status = 404;
        throw e;
      }
    }

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: {
        ...(input.pushEnabled !== undefined ? { pushEnabled: input.pushEnabled } : {}),
        ...(input.entryEnabled !== undefined ? { entryEnabled: input.entryEnabled } : {}),
        ...(input.exitEnabled !== undefined ? { exitEnabled: input.exitEnabled } : {}),
        ...(input.customEnabled !== undefined ? { customEnabled: input.customEnabled } : {}),
        ...(input.defaultSoundId !== undefined ? { defaultSoundId: input.defaultSoundId } : {}),
        ...(input.volume !== undefined ? { volume: input.volume } : {}),
      },
      create: { userId: user.id, ...input },
    });
    return ok({ preferences: prefs });
  } catch (err) {
    return toErrorResponse(err);
  }
}
