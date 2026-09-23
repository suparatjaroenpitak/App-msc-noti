#!/usr/bin/env sh
# แก้ปัญหา P3009 (failed migrations) / เริ่ม migration history ใหม่บน database ที่ยังไม่มีข้อมูลจริง
#
# ใช้: DATABASE_URL="file:./data/stock-alert.db" sh scripts/reset-migrations.sh
#
# ⚠️ สคริปต์นี้ DROP ทุกตารางใน schema public ของ DATABASE_URL — ใช้เฉพาะ:
#   1) ฐานข้อมูลเปล่า/ใหม่ หรือ
#   2) DB ที่ migration เคย fail ค้างและยังไม่มีข้อมูลผู้ใช้จริง
# ห้ามใช้กับ production ที่มีข้อมูลแล้ว (ให้ใช้ prisma migrate resolve แทน — ดู README)

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ต้องตั้ง DATABASE_URL ก่อน (DATABASE_URL=\"file:./data/stock-alert.db\" sh scripts/reset-migrations.sh)"
  exit 1
fi

echo "==> Reset migration history และตารางทั้งหมดใน: $DATABASE_URL"
echo "    (ยกเลิกภายใน 5 วินาที — Ctrl+C)"
sleep 5

npx prisma db execute --schema prisma/schema.prisma --stdin <<'SQL'
DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public";
GRANT ALL ON SCHEMA "public" TO CURRENT_USER;
SQL

echo "==> ประวัติ migration ถูกล้าง — ตอนนี้จะ apply 0_init ใหม่ทั้งหมด"
npx prisma migrate deploy

echo "==> Seed ข้อมูลเริ่มต้น"
npx tsx prisma/seed.ts

echo "✅ เสร็จ — ตรวจสอบด้วย: npx prisma migrate status"
