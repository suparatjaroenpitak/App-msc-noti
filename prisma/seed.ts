/* eslint-disable no-console */
// Seed: 10 US stocks/ETFs + demo user + built-in notification sounds.
// Built-in sounds are WAV files generated here (sine beeps) into public/sounds
// if they do not already exist. Run with: npm run db:seed

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

const ASSETS = [
  { symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", exchange: "NASDAQ", type: "STOCK" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", exchange: "NYSE Arca", type: "ETF" },
  { symbol: "VTI", name: "Vanguard Total Stock Market ETF", exchange: "NYSE Arca", type: "ETF" },
  { symbol: "QQQM", name: "Invesco NASDAQ 100 ETF", exchange: "NASDAQ", type: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ Trust", exchange: "NASDAQ", type: "ETF" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", exchange: "NYSE Arca", type: "ETF" },
];

// --- minimal WAV writer (16-bit PCM mono) ---
function makeWav(samples: Float32Array, sampleRate: number): Buffer {
  const dataLength = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataLength);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buffer;
}

function beep(freq: number, seconds: number, sampleRate = 44100): Float32Array {
  const n = Math.floor(sampleRate * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const envelope = Math.min(1, (n - i) / (sampleRate * 0.05)) * Math.min(1, i / (sampleRate * 0.01));
    out[i] = Math.sin(2 * Math.PI * freq * t) * 0.6 * envelope;
  }
  return out;
}

function concat(...parts: Float32Array[]): Float32Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const BUILTIN_SOUNDS: Array<{ file: string; name: string; gen: () => Float32Array; duration: number }> = [
  { file: "chime.wav", name: "Chime (Built-in)", gen: () => concat(beep(880, 0.18), beep(1320, 0.25)), duration: 0.45 },
  { file: "ding.wav", name: "Ding (Built-in)", gen: () => concat(beep(1046, 0.3)), duration: 0.32 },
  { file: "alert.wav", name: "Alert (Built-in)", gen: () => concat(beep(660, 0.12), beep(660, 0.12), beep(990, 0.3)), duration: 0.56 },
];

async function ensureSoundFiles(publicDir: string) {
  const dir = path.join(publicDir, "sounds");
  await fs.promises.mkdir(dir, { recursive: true });
  for (const s of BUILTIN_SOUNDS) {
    const p = path.join(dir, s.file);
    if (!fs.existsSync(p)) {
      await fs.promises.writeFile(p, makeWav(s.gen(), 44100));
      console.log(`  wrote public/sounds/${s.file}`);
    }
  }
}

async function main() {
  const publicDir = path.resolve(process.cwd(), "public");
  await ensureSoundFiles(publicDir);

  for (const a of ASSETS) {
    await prisma.asset.upsert({
      where: { symbol: a.symbol },
      update: { name: a.name, exchange: a.exchange, type: a.type as "STOCK" | "ETF" },
      create: { symbol: a.symbol, name: a.name, exchange: a.exchange, type: a.type as "STOCK" | "ETF", currency: "USD" },
    });
  }
  console.log(`Seeded ${ASSETS.length} assets`);

  // Single implicit user (auth removed) — must match DEFAULT_EMAIL in src/lib/api/handler.ts
  const demoEmail = "demo@example.com";
  const demo = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {},
    create: {
      name: "ผู้ใช้ในเครื่อง",
      email: demoEmail,
      // Legacy schema-required column; auth is gone so store an unusable random value.
      passwordHash: `disabled:${crypto.randomUUID()}`,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { userId: demo.id },
    update: {},
    create: { userId: demo.id },
  });

  await prisma.analysisSettings.upsert({
    where: { userId: demo.id },
    update: {},
    create: { userId: demo.id },
  });

  console.log(`Default user ready: ${demoEmail} (no password — auth removed)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
