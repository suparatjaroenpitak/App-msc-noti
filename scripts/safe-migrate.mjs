#!/usr/bin/env node
// safe-migrate — wrapper ของ `prisma migrate deploy` สำหรับ deploy บน Render/Docker
//
// ทำงาน:
//   1. รัน `prisma migrate deploy`
//   2. ถ้าล้มด้วย P3009 (มี record migration ที่ FAILED ค้างใน DB):
//        - ถ้า DB_AUTO_RECOVER=true  → ล้าง schema "public" + ประวัติ migration
//          แล้ว apply migration ใหม่ทั้งหมด (auto-repair)
//        - ถ้าไม่ได้ตั้ง flag        → พิมพ์วิธีแก้แล้ว exit 1 (ไม่แตะ DB)
//
// ⚠️ auto-repair จะ DROP ทุกตารางใน schema "public" — เปิดใช้เฉพาะ DB ที่ยังไม่มีข้อมูลจริง
//    (deploy แรก ๆ / DB ที่ migration พังค้าง) ส่วน DB ที่มีข้อมูลแล้วให้ใช้
//    `npx prisma migrate resolve` แทน — ดู README หัวข้อ Troubleshooting

import { spawnSync } from "node:child_process";

const RED = "\x1b[31m";
const YEL = "\x1b[33m";
const GRN = "\x1b[32m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const isWin = process.platform === "win32";

function runPrisma(args, { input } = {}) {
  const res = spawnSync("npx", args, {
    input,
    encoding: "utf8",
    env: process.env,
    shell: isWin,
  });
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  return { code: res.status ?? 1, out: `${res.stdout ?? ""}${res.stderr ?? ""}` };
}

console.log(`${GRN}==> safe-migrate: prisma migrate deploy${RST}`);
const first = runPrisma(["prisma", "migrate", "deploy"]);

if (first.code === 0) {
  console.log(`${GRN}==> migrate deploy OK${RST}`);
  process.exit(0);
}

if (!first.out.includes("P3009")) {
  console.error(
    `${RED}==> migrate deploy failed (ไม่ใช่ P3009) — ดู error ด้านบน
    ถ้าเป็น P1012 (Environment variable not found: DATABASE_URL) =
    ตั้งค่า DATABASE_URL บน platform ไม่ครบ/ผิดรูปแบบ (วางเฉพาะ URL อย่างเดียว)${RST}`,
  );
  process.exit(first.code);
}

console.error(`${YEL}
┌──────────────────────────────────────────────────────────────────────┐
│ P3009: database มี record migration ที่ FAILED ค้างอยู่                │
│ Prisma จะไม่ apply migration ใหม่จนกว่าจะแก้ (resolve หรือ reset)      │
└──────────────────────────────────────────────────────────────────────┘${RST}`);

if (process.env.DB_AUTO_RECOVER !== "true") {
  console.error(`
วิธีแก้ (เลือกทางเดียว):

  A) DB ยังไม่มีข้อมูลจริง (deploy แรก ๆ — แนะนำ):
       เพิ่ม Environment Variable บน Render:  DB_AUTO_RECOVER = true
       แล้ว redeploy — สคริปต์นี้จะล้าง schema + ประวัติ migration
       แล้ว apply migration ทั้งหมดใหม่ให้เอง
       * หลัง deploy สำเร็จแล้วให้ลบตัวแปรนี้ทิ้ง

  B) DB มีข้อมูลจริงแล้ว (ห้าม reset):
       npx prisma migrate resolve --rolled-back <ชื่อ-migration>
       แล้วแก้สาเหตุ / สร้าง migration ใหม่ แล้ว deploy อีกครั้ง
       (รายละเอียดใน README หัวข้อ Troubleshooting)
`);
  process.exit(first.code);
}

console.warn(`${RED}⚠  DB_AUTO_RECOVER=true → จะ DROP ทุกตารางใน schema "public" แล้ว apply migration ใหม่ทั้งหมด${RST}`);
console.warn(`${DIM}   ยกเลิกได้ภายใน 5 วินาที (กด Ctrl+C)${RST}`);
await new Promise((r) => setTimeout(r, 5000));

console.log(`==> ล้าง schema "public" ...`);
const drop = runPrisma(["prisma", "db", "execute", "--stdin"], {
  input:
    'DROP SCHEMA IF EXISTS "public" CASCADE;\n' +
    'CREATE SCHEMA "public";\n' +
    'GRANT ALL ON SCHEMA "public" TO CURRENT_USER;\n',
});
if (drop.code !== 0) {
  console.error(`${RED}==> ล้าง schema ไม่สำเร็จ — ดู error ด้านบน${RST}`);
  process.exit(drop.code);
}

console.log(`==> ล้างเสร็จ — apply migration ทั้งหมดใหม่ ...`);
const second = runPrisma(["prisma", "migrate", "deploy"]);
if (second.code === 0) {
  console.log(`${GRN}==> auto-repair สำเร็จ — migration ถูก apply ครบแล้ว${RST}`);
}
process.exit(second.code);
