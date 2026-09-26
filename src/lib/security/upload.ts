import { env } from "@/lib/env";
import { badRequest } from "@/lib/api/response";

const ALLOWED_EXT = ["mp3", "wav", "ogg", "m4a"] as const;
type AllowedExt = (typeof ALLOWED_EXT)[number];

const MIME_BY_EXT: Record<AllowedExt, string[]> = {
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  ogg: ["audio/ogg", "application/ogg"],
  m4a: ["audio/mp4", "audio/m4a", "audio/x-m4a"],
};

export interface ValidatedSoundFile {
  buffer: Buffer;
  ext: AllowedExt;
  mimeType: string;
  sanitizedName: string;
}

/** Strip path components and control characters; keep a display name only. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\x00-\x1f\x7f]/g, "").replace(/[^\w.\- ]+/g, "_").trim();
  return cleaned.length ? cleaned.slice(0, 100) : "file";
}

/** Magic-byte sniffing to reject disguised files (e.g. .exe renamed to .wav). */
export function detectAudioExt(buffer: Buffer): "mp3" | "wav" | "ogg" | "m4a" | null {
  if (buffer.length < 12) return null;
  // WAV: "RIFF"...."WAVE"
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") return "wav";
  // OGG: "OggS"
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") return "ogg";
  // MP3: ID3 tag or MPEG frame sync 0xFFEx
  if (buffer.subarray(0, 3).toString("ascii") === "ID3") return "mp3";
  if (buffer[0] === 0xff && (buffer[1]! & 0xe0) === 0xe0) return "mp3";
  // M4A: ISO BMFF container with ftyp box
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buffer.subarray(8, 12).toString("ascii");
    if (brand.startsWith("M4A") || brand.startsWith("mp4") || brand.startsWith("isom")) return "m4a";
    return "m4a";
  }
  return null;
}

export async function validateSoundUpload(file: File): Promise<ValidatedSoundFile> {
  const sanitizedName = sanitizeFileName(file.name || "file");
  const ext = (sanitizedName.split(".").pop() ?? "").toLowerCase() as AllowedExt;

  if (!ALLOWED_EXT.includes(ext)) {
    throw badRequest("Unsupported file type. Allowed: mp3, wav, ogg, m4a");
  }
  const allowedMimes = MIME_BY_EXT[ext]!;
  // Mobile OS pickers (iOS/Android) often report generic MIME types like
  // "application/octet-stream" or an empty string. Magic-byte sniffing below is
  // the real gate, so only reject when the browser reports a *specific* wrong type.
  const GENERIC_MIMES = new Set(["", "application/octet-stream", "application/binary", "application/download"]);
  if (file.type && !GENERIC_MIMES.has(file.type) && !allowedMimes.includes(file.type)) {
    throw badRequest(`MIME type "${file.type}" does not match extension .${ext}`);
  }
  if (file.size <= 0) throw badRequest("Empty file");
  if (file.size > env.sounds.maxSizeBytes) {
    throw badRequest(`File too large (max ${Math.floor(env.sounds.maxSizeBytes / (1024 * 1024))} MB)`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const sniffed = detectAudioExt(buffer);
  if (!sniffed) {
    throw badRequest("File content is not a recognized audio file (magic bytes check failed)");
  }
  if (sniffed !== ext) {
    throw badRequest(`File content looks like .${sniffed} but the extension is .${ext}`);
  }

  return { buffer, ext, mimeType: file.type || allowedMimes[0]!, sanitizedName };
}

/** Random storage key for uploaded sounds — never derived from user file names. */
export function generateStorageKey(prefix = "snd"): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}
