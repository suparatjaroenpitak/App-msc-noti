import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const BCRYPT_COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Generate a cryptographically random URL-safe token (used for sessions & resets). */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** SHA-256 hash for storing tokens — never store raw tokens in the DB. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Random storage key for uploaded sounds — never derive from user file names. */
export function generateStorageKey(prefix = "snd"): string {
  return `${prefix}_${crypto.randomBytes(16).toString("hex")}`;
}
