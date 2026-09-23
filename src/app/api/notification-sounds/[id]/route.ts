import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, notFound } from "@/lib/api/response";
import { requireUser, assertSameOrigin } from "@/lib/api/handler";
import { renameSoundSchema } from "@/lib/validation/schemas";
import fs from "node:fs";
import path from "node:path";

const SOUND_DIR = path.join(process.cwd(), "data", "sounds");

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { id } = await params;

    const sound = await prisma.notificationSound.findUnique({ where: { id } });
    if (!sound || sound.userId !== user.id) throw notFound("Sound");

    const { name } = renameSoundSchema.parse(await req.json());
    const updated = await prisma.notificationSound.update({ where: { id }, data: { name } });
    return ok({ sound: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    const { id } = await params;

    const sound = await prisma.notificationSound.findUnique({ where: { id } });
    if (!sound || sound.userId !== user.id) throw notFound("Sound");

    // Remove the physical file (only for uploaded sounds with our key format).
    const key = sound.fileUrl.split("/").pop() ?? "";
    if (/^snd_[a-f0-9]{32}\.[a-z0-9]{2,4}$/.test(key)) {
      await fs.promises.unlink(path.join(SOUND_DIR, key)).catch(() => undefined);
    }

    // DB references use SetNull; also unset preference defaults pointing here.
    await prisma.notificationPreference.updateMany({ where: { defaultSoundId: id }, data: { defaultSoundId: null } });

    await prisma.notificationSound.delete({ where: { id } });
    return ok({ deleted: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
