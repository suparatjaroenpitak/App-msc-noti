#!/usr/bin/env node
// Seed เฉพาะเมื่อตั้ง FRESH_DB_SEED=true — สำหรับ deploy แรกบน database ใหม่
// (idempotent: seed ใช้ upsert รันซ้ำได้) หลัง deploy สำเร็จแล้วควรปิด/ลบตัวแปรนี้

import { spawnSync } from "node:child_process";

if (process.env.FRESH_DB_SEED !== "true") {
  process.exit(0);
}

console.log("==> FRESH_DB_SEED=true — รัน seed (demo user + assets + สัญลักษณ์เริ่มต้น) ...");
const res = spawnSync("npx", ["tsx", "prisma/seed.ts"], {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});
process.exit(res.status ?? 1);
