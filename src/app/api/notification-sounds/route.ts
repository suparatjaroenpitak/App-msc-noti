import { prisma } from "@/lib/db/prisma";
import { ok, toErrorResponse, fail } from "@/lib/api/response";
import { requireUser, assertSameOrigin, ensureUserRateLimit } from "@/lib/api/handler";
import { validateSoundUpload } from "@/lib/security/upload";
import { generateStorageKey } from "@/lib/auth/password";
import { env } from "@/lib/env";
import fs from "node:fs";
import path from "node:path";

const SOUND_DIR = path.join(process.cwd(), "data", "sounds");

/** GET — list the user's sounds (built-ins + uploads). */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const sounds = await prisma.notificationSound.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return ok({ sounds });
  } catch (err) {
    return toErrorResponse(err);
  }
}

/** POST — multipart upload with strict validation. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireUser(req);
    ensureUserRateLimit(user.id, "sound-upload", 10, 3600);

    const form = await req.formData();
    const file = form.get("file");
    const nameInput = form.get("name");

    if (!(file instanceof File)) {
      return fail(400, "BAD_REQUEST", "Missing 'file' field");
    }
    const displayName =
      typeof nameInput === "string" && nameInput.trim().length >= 1
        ? nameInput.trim().slice(0, 60)
        : file.name.replace(/\.[^.]+$/, "").slice(0, 60) || "My sound";

    const validated = await validateSoundUpload(file);

    // Random storage key — never derived from the user's filename.
    const key = `${generateStorageKey("snd")}.${validated.ext}`;
    await fs.promises.mkdir(SOUND_DIR, { recursive: true });
    await fs.promises.writeFile(path.join(SOUND_DIR, key), validated.buffer);

    // Duration is measured client-side and sent along; re-check against the limit.
    const durationInput = Number(form.get("duration") ?? "0");
    const duration = Number.isFinite(durationInput) && durationInput > 0 ? durationInput : null;
    if (duration && duration > env.sounds.maxDurationSeconds) {
      await fs.promises.unlink(path.join(SOUND_DIR, key)).catch(() => undefined);
      return fail(400, "BAD_REQUEST", `Audio duration exceeds ${env.sounds.maxDurationSeconds}s limit`);
    }

    const sound = await prisma.notificationSound.create({
      data: {
        userId: user.id,
        name: displayName,
        fileUrl: `/api/notification-sounds/file/${key}`,
        mimeType: validated.mimeType,
        fileSize: validated.buffer.length,
        duration,
      },
    });

    return ok({ sound }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
