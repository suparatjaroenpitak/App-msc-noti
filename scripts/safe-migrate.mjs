#!/usr/bin/env node
// safe-migrate — wrapper ของ `prisma migrate deploy` สำหรับ deploy บน Render/Docker (SQLite)
//
// ทำงาน:
//   1. Preflight — เช็คว่าไฟล์/โฟลเดอร์ของ SQLite สร้างและเขียนได้จริง (ก่อน migrate)
//      ถ้าไม่ได้ → exit 1 พร้อมสาเหตุที่พบบ่อย (กัน deploy แขวนนิ่งจน Render
//      "Port scan timeout" เพราะ server ไม่เคยได้สตาร์ท)
//   2. รัน `prisma migrate deploy` — stream output สด ๆ ลง log ทันที
//      และบังคับ timeout (MIGRATE_TIMEOUT_SECONDS, default 300 วิ)
//   3. ถ้าล้มด้วย P3009 (มี record migration ที่ FAILED ค้างใน DB):
//        - ถ้า DB_AUTO_RECOVER=true  → ลบไฟล์ SQLite (ข้อมูลหายหมด!) แล้ว apply migration ใหม่ทั้งหมด
//        - ถ้าไม่ได้ตั้ง flag        → พิมพ์วิธีแก้แล้ว exit 1 (ไม่แตะ DB)
//
// ⚠️ auto-recover จะ "ลบไฟล์ SQLite" — เปิดใช้เฉพาะ DB ที่ยังไม่มีข้อมูลจริง
//    (deploy แรก ๆ / DB ที่ migration พังค้าง) ส่วน DB ที่มีข้อมูลแล้วให้ใช้
//    `npx prisma migrate resolve` แทน — ดู README หัวข้อ Troubleshooting

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RED = "\x1b[31m";
const YEL = "\x1b[33m";
const GRN = "\x1b[32m";
const DIM = "\x1b[2m";
const RST = "\x1b[0m";

const isWin = process.platform === "win32";

const MIGRATE_TIMEOUT_SECONDS = Number(process.env.MIGRATE_TIMEOUT_SECONDS || 300);

// SQLite URL อาจเป็น file:./dev.db (relative) หรือ file:/abs/path.db — แปลงเป็น absolute path
// ⚠️ Prisma resolve path แบบ relative เทียบกับตำแหน่ง schema.prisma (โฟลเดอร์ prisma/)
//    สคริปต์นี้จึง resolve แบบเดียวกัน เพื่อให้ preflight/auto-recover ชี้ไฟล์ถูกตัว
function sqliteFilePathFromUrl(url) {
  if (!url || !url.trim().toLowerCase().startsWith("file:")) return null;
  let p = url.trim().slice(5);
  // ตัด query params เช่น ?connection_limit=1 และถอด URL-encoding เช่น %20
  p = p.split("?")[0];
  try {
    p = decodeURIComponent(p);
  } catch {
    /* ปล่อยตามเดิมถ้า decode ไม่ได้ */
  }
  if (!p || p === ":memory:") return p === ":memory:" ? ":memory:" : null;
  const schemaDir = path.resolve(process.cwd(), "prisma");
  return path.isAbsolute(p) ? p : path.resolve(schemaDir, p);
}

// รันคำสั่งโดย stream stdout/stderr สด ๆ ลง process log (Render จะเห็นความคืบหน้าจริง)
// พร้อมเก็บ output ไว้ให้ caller เช็ก error code เช่น P3009 และบังคับ hard timeout
function run(args, { input, timeoutSeconds = MIGRATE_TIMEOUT_SECONDS } = {}) {
  return new Promise((resolve) => {
    const child = spawn("npx", args, {
      env: process.env,
      shell: isWin,
      detached: !isWin, // linux: แยก process group เพื่อ kill ทั้ง npx + prisma ตอน timeout
    });

    let out = "";
    let settled = false;
    let timedOut = false;

    const onData = (chunk) => {
      const text = chunk.toString();
      out += text;
      process.stdout.write(text);
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);

    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, out, timedOut });
    };

    const killTree = () => {
      if (isWin) {
        child.kill();
        return;
      }
      try {
        if (child.pid) process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killTree();
    }, timeoutSeconds * 1000);

    // กัน EPIPE ตอน child ตายก่อนเขียน stdin จบ
    child.stdin?.on("error", () => {});
    if (input !== undefined) child.stdin.end(input);

    child.on("error", (err) => {
      process.stderr.write(`==> spawn failed: ${err.message}\n`);
      finish(1);
    });

    child.on("close", (code) => {
      if (timedOut) {
        process.stderr.write(
          `\n${RED}==> คำสั่งค้างเกิน ${timeoutSeconds} วินาที — ถูก kill ทิ้ง (ปรับได้ผ่าน env)${RST}\n`,
        );
        finish(1);
      } else {
        finish(code ?? 1);
      }
    });

    // เผื่อกรณี kill แล้ว stdio ไม่ปิด (orphan process ยังถือ pipe อยู่)
    setTimeout(() => finish(timedOut ? 1 : (child.exitCode ?? 1)), (timeoutSeconds + 10) * 1000).unref();
  });
}

function dieWithConnectionHelp(dbFile) {
  console.error(`${RED}
==> เข้าถึงไฟล์ SQLite ไม่สำเร็จ (${dbFile ?? "ไม่รู้จัก path"}) — deploy จบตรงนี้เพื่อไม่ให้แขวนจน Port scan timeout

  สาเหตุที่พบบ่อย:
  1) ไม่ได้ตั้ง DATABASE_URL หรือรูปแบบผิด (ต้องขึ้นด้วย file: เช่น file:/app/data/stock-alert.db)
  2) โฟลเดอร์ของไฟล์ DB ยังไม่มีอยู่หรือไม่มีสิทธิ์เขียน
     → Docker/Render: โฟลเดอร์ /app/data ถูกสร้างให้แล้วใน image; ตรวจว่า mount ของคุณ
       เขียนได้โดย user "app" (uid ของ adduser -S app)
  3) filesystem เต็มหรือ mount เป็น read-only${RST}`);
  process.exit(1);
}

// ---------- Preflight ----------
const dbFile = sqliteFilePathFromUrl(process.env.DATABASE_URL);
if (dbFile === ":memory:") {
  console.log(`${YEL}==> แจ้งเตือน: DATABASE_URL เป็น :memory: — ข้อมูลจะหายเมื่อ process จบ${RST}`);
} else if (dbFile) {
  const dir = path.dirname(dbFile);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    const probe = path.join(dir, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe, { force: true });
    console.log(`${GRN}==> preflight OK — SQLite พร้อมใช้งานที่ ${dbFile}${RST}`);
  } catch (err) {
    console.error(`==> preflight failed ที่ ${dir}: ${err instanceof Error ? err.message : err}`);
    dieWithConnectionHelp(dbFile);
  }
} else {
  dieWithConnectionHelp(null);
}

// ---------- Migrate ----------
console.log(`${GRN}==> safe-migrate: prisma migrate deploy (timeout ${MIGRATE_TIMEOUT_SECONDS}s)${RST}`);
const first = await run(["prisma", "migrate", "deploy"]);

if (first.code === 0) {
  console.log(`${GRN}==> migrate deploy OK${RST}`);
  process.exit(0);
}

if (first.timedOut) {
  console.error(`${RED}==> migrate ค้างเกินเวลา — ปรับ MIGRATE_TIMEOUT_SECONDS ได้${RST}`);
  process.exit(1);
}

if (!first.out.includes("P3009")) {
  console.error(
    `${RED}==> migrate deploy failed (ไม่ใช่ P3009) — ดู error ด้านบน
    ถ้าเป็น P1012 (Environment variable not found: DATABASE_URL) =
    ตั้งค่า DATABASE_URL บน platform ไม่ครบ/ผิดรูปแบบ (ต้องขึ้นด้วย file:)${RST}`,
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
       แล้ว redeploy — สคริปต์นี้จะลบไฟล์ SQLite แล้ว apply migration ทั้งหมดใหม่ให้เอง
       * หลัง deploy สำเร็จแล้วให้ลบตัวแปรนี้ทิ้ง

  B) DB มีข้อมูลจริงแล้ว (ห้าม reset):
       npx prisma migrate resolve --rolled-back <ชื่อ-migration>
       แล้วแก้สาเหตุ / สร้าง migration ใหม่ แล้ว deploy อีกครั้ง
       (รายละเอียดใน README หัวข้อ Troubleshooting)
`);
  process.exit(first.code);
}

console.warn(`${RED}⚠  DB_AUTO_RECOVER=true → จะลบไฟล์ SQLite (${dbFile}) แล้ว apply migration ใหม่ทั้งหมด${RST}`);
console.warn(`${DIM}   ยกเลิกได้ภายใน 5 วินาที (กด Ctrl+C)${RST}`);
await new Promise((r) => setTimeout(r, 5000));

console.log(`==> ลบไฟล์ SQLite ...`);
try {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    fs.rmSync(`${dbFile}${suffix}`, { force: true });
  }
} catch (err) {
  console.error(`${RED}==> ลบไฟล์ไม่สำเร็จ — ${err instanceof Error ? err.message : err}${RST}`);
  process.exit(1);
}

console.log(`==> ลบเสร็จ — apply migration ทั้งหมดใหม่ ...`);
const second = await run(["prisma", "migrate", "deploy"]);
if (second.code === 0) {
  console.log(`${GRN}==> auto-recover สำเร็จ — migration ถูก apply ครบแล้ว${RST}`);
}
process.exit(second.code);
