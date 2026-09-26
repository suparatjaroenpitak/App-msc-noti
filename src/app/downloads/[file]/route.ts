import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const FILES: Record<string, { type: string; filename: string }> = {
  "StockAlert-release.apk": { type: "application/vnd.android.package-archive", filename: "StockAlert-v2.1.0.apk" },
  "StockAlert-release.ipa": { type: "application/octet-stream", filename: "StockAlert-v2.1.0.ipa" },
};
const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");

/** GET /downloads/:file — serve app binaries with a friendly download filename. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  const meta = FILES[file];
  if (!meta) {
    return NextResponse.json({ ok: false, error: { code: "NOT_FOUND", message: "Unknown file" } }, { status: 404 });
  }
  const filePath = path.join(DOWNLOADS_DIR, file);
  if (!existsSync(filePath)) {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_FOUND", message: "File not built yet — copy mobile/apk/StockAlert-release.apk to public/downloads/" } },
      { status: 404 },
    );
  }
  const size = statSync(filePath).size;
  const stream = createReadStream(filePath) as unknown as ReadableStream;
  return new NextResponse(stream, {
    headers: {
      "Content-Type": meta.type,
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${meta.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
