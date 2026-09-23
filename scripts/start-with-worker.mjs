#!/usr/bin/env node
// จุดเริ่ม container เดียว: migrate → seed (opt-in) → Next.js + background worker
// (SQLite เป็นไฟล์เดียว — รัน worker ข้าม container ไม่ได้ จึงรวมไว้ที่นี่)
//
// - RUN_WORKER_IN_WEB=true (default) → spawn worker คู่กับ `npm run start`
// - RUN_WORKER_IN_WEB=false → รันแค่ Next.js
// - SIGTERM/SIGINT → ส่งต่อ signal ให้ลูกทั้งสอง แล้ว exit ด้วย exit code ของ Next

import { spawn, spawnSync } from "node:child_process";

const isWin = process.platform === "win32";
const runWorker = (process.env.RUN_WORKER_IN_WEB ?? "true").toLowerCase() !== "false";

const children = [];
let shuttingDown = false;

function forward(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && !child.killed) {
      try {
        child.kill(signal);
      } catch {
        /* child อาจจบไปแล้ว */
      }
    }
  }
}

function runStep(name, script) {
  console.log(`==> ${name} ...`);
  const res = spawnSync("node", [script], { stdio: "inherit", env: process.env, shell: isWin });
  if (res.status !== 0) {
    console.error(`==> ${name} failed (exit=${res.status}) — หยุด startup`);
    process.exit(res.status ?? 1);
  }
}

function spawnChild(name, command, args) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: process.env,
    shell: isWin,
  });
  child.on("error", (err) => {
    console.error(`[${name}] spawn failed:`, err.message);
  });
  return child;
}

async function main() {
  // 1) migrate (มี preflight/timeout กัน deploy แขวน) 2) seed เมื่อ FRESH_DB_SEED=true
  runStep("safe-migrate (prisma migrate deploy)", "scripts/safe-migrate.mjs");
  runStep("seed-if-fresh", "scripts/seed-if-fresh.mjs");

  console.log(`==> starting app${runWorker ? " + worker" : ""} (single container, SQLite) ...`);

  if (runWorker) {
    children.push(spawnChild("worker", "npx", ["tsx", "worker/index.ts"]));
  }

  const app = spawnChild("next", "npm", ["run", "start"]);
  children.push(app);

  process.on("SIGTERM", () => forward("SIGTERM"));
  process.on("SIGINT", () => forward("SIGINT"));

  // Next ตาย = ทั้ง container ควรตาย (platform จะ restart ให้)
  app.on("close", (code) => {
    if (shuttingDown) process.exit(code ?? 0);
    console.error(`==> next exited unexpectedly (code=${code}) — shutting down worker`);
    forward("SIGTERM");
    setTimeout(() => process.exit(code ?? 1), 2000).unref();
  });
}

await main();
