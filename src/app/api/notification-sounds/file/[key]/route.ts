import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/api/handler";
import { toErrorResponse, notFound } from "@/lib/api/response";
import fs from "node:fs";
import path from "node:path";

const SOUND_DIR = path.join(process.cwd(), "data", "sounds");

export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    await requireUser(req); // sounds are private per user
    const { key } = await params;

    // Reject anything that is not our generated key format (also blocks path traversal).
    if (!/^snd_[a-f0-9]{32}\.[a-z0-9]{2,4}$/.test(key)) {
      throw notFound("Sound file");
    }

    const sound = await prisma.notificationSound.findFirst({ where: { fileUrl: `/api/notification-sounds/file/${key}` } });
    if (!sound) throw notFound("Sound file");

    const filePath = path.join(SOUND_DIR, key);
    if (!fs.existsSync(filePath)) throw notFound("Sound file");

    const stat = await fs.promises.stat(filePath);
    const data = await fs.promises.readFile(filePath);
    // Files are capped at MAX_SOUND_FILE_SIZE_MB, so buffering is fine.
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": sound.mimeType,
        "Content-Length": String(stat.size),
        "Content-Disposition": `inline; filename="${sound.name.replace(/["\\]/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
