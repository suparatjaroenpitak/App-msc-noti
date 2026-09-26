import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const ALLOWED = new Set(["StockAlert-release.apk"]);
const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");

/** GET /downloads/:file — serve the APK with a friendly download filename. */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!ALLOWED.has(file)) {
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
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="StockAlert-v1.2.0.apk"`,
      "Cache-Control": "no-store",
    },
  });
}
