#!/usr/bin/env node
// Seed เฉพาะเมื่อตั้ง FRESH_DB_SEED=true — สำหรับ deploy แรกบน database ใหม่
// (idempotent: seed ใช้ upsert รันซ้ำได้) หลัง deploy สำเร็จแล้วควรปิด/ลบตัวแปรนี้
//
// บังคับ timeout (SEED_TIMEOUT_SECONDS, default 180 วิ) เพื่อไม่ให้ seed ค้าง
// จน Render "Port scan timeout" — ถ้า DB เชื่อมต่อช้าให้เพิ่มค่า env นี้

import { spawn } from "node:child_process";

if (process.env.FRESH_DB_SEED !== "true") {
  process.exit(0);
}

const isWin = process.platform === "win32";
const SEED_TIMEOUT_SECONDS = Number(process.env.SEED_TIMEOUT_SECONDS || 180);

console.log(`==> FRESH_DB_SEED=true — รัน seed (demo user + assets + สัญลักษณ์เริ่มต้น, timeout ${SEED_TIMEOUT_SECONDS}s) ...`);

const child = spawn("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: isWin,
  detached: !isWin,
});

const timer = setTimeout(() => {
  console.error(`==> seed ค้างเกิน ${SEED_TIMEOUT_SECONDS} วินาที — kill (ปรับได้ผ่าน SEED_TIMEOUT_SECONDS)`);
  try {
    if (!isWin && child.pid) process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  } catch {
    /* child อาจจบไปแล้ว */
  }
}, SEED_TIMEOUT_SECONDS * 1000);

child.on("error", (err) => {
  clearTimeout(timer);
  console.error(`==> spawn seed failed: ${err.message}`);
  process.exit(1);
});

child.on("close", (code) => {
  clearTimeout(timer);
  process.exit(code ?? 1);
});
