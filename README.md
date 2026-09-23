# Stock Alert PWA

> ติดตามราคาหุ้นและ ETF สหรัฐฯ พร้อมระบบแจ้งเตือนตามเงื่อนไขของผู้ใช้
> **ไม่ใช่คำแนะนำการลงทุน และไม่รับประกันผลกำไร**

Next.js App Router · TypeScript Strict · Tailwind CSS · Prisma · PostgreSQL · Web Push (VAPID) · PWA

## ฟีเจอร์

- ✅ สมัครสมาชิก / เข้าสู่ระบบ / ลืมรหัสผ่าน / เปลี่ยนรหัสผ่าน (bcrypt + session แบบ DB-backed)
- ✅ ค้นหาหุ้น/ETF (debounced search, provider จริงหรือ mock สำหรับ dev)
- ✅ Watchlist — เพิ่ม/ลบ/เรียงลำดับ + ราคาล่าสุด, % เปลี่ยนแปลง, จำนวน Alert
- ✅ Asset detail — ราคา, high/low, prevClose, กราฟ in-session, รายการ Alert
- ✅ Price Alert — ENTRY/EXIT/CUSTOM × ABOVE_OR_EQUAL/BELOW_OR_EQUAL, one-time, cooldown, duplicate, test
- ✅ Background Worker ทุก 60 วินาที (dedupe symbol, retry+backoff, cooldown, idempotency lock ผ่าน DB, graceful shutdown) — deploy แยกได้
- ✅ Web Push ครบวงจร — VAPID, หลายอุปกรณ์ต่อผู้ใช้, ลบ subscription ตาย, test notification, delivery logs
- ✅ Custom Sound — อัปโหลด/พรีวิว/เปลี่ยนชื่อ/ลบ/ตั้ง default + **Browser Limitation Notice ชัดเจน** (foreground เท่านั้น, fallback เสียงระบบ)
- ✅ PWA — installable, offline fallback, install guide ครบ 4 แพลตฟอร์ม
- ✅ Dark/Light mode, Mobile-first responsive (Sidebar + Bottom Nav), Skeleton/Empty/Error states, Toast, Confirm dialog
- ✅ Security — Zod validation ทุก input, ownership check กัน IDOR, rate limiting, SameSite cookies, random storage keys, ไม่ส่ง secret ไป frontend

## โครงสร้าง

```
src/app/            # App Router: (auth), (dashboard), api/*, install
src/components/     # ui/, layout/, theme, push provider
src/lib/            # auth, db, market-data, notifications, push, security, validation
src/worker/         # alert-engine, market-poller
worker/             # standalone worker entrypoint (npm run worker)
prisma/             # schema + seed
public/             # sw.js, manifest, icons, sounds, offline.html
tests/              # unit (vitest) + e2e (playwright)
```

## เริ่มต้น (Development)

```bash
# 1) ติดตั้ง dependencies
npm install

# 2) ตั้งค่า environment
cp .env.example .env
#   - แก้ DATABASE_URL ให้ตรงกับ Postgres ของคุณ
#   - สร้าง AUTH_SECRET: openssl rand -base64 32
#   - สร้าง VAPID keys: npx web-push generate-vapid-keys

# 3) สร้าง DB + seed
npx prisma migrate dev --name init
npm run db:seed

# 4) รันแอป + worker (สอง terminal)
npm run dev          # Next.js ที่ http://localhost:3000
npm run worker       # Background worker (poll ทุก POLLING_INTERVAL_SECONDS)

# บัญชีทดลองหลัง seed: demo@example.com / demo1234
```

> **MARKET_DATA_PROVIDER=mock ใช้เพื่อ development/ทดสอบเท่านั้น** — ราคาเป็นข้อมูลจำลอง
> Production ต้องตั้งค่า provider จริง (twelvedata | alphavantage | finnhub) พร้อม API key

## วิธีทดสอบ

```bash
npm run typecheck    # TypeScript strict
npm test             # Vitest unit tests (alert engine, validation, market status)
npm run test:e2e     # Playwright E2E (ต้องรัน dev + DB + seed ก่อน)
```

## Push Notification (สรุปการทำงาน)

1. ผู้ใช้เปิดสวิตช์ในหน้า Notifications/Settings → request permission → subscribe ด้วย VAPID public key
2. Subscription ถูกบันทึกลง `PushSubscription` (รองรับหลายอุปกรณ์)
3. Worker เจอเงื่อนไข → atomic conditional UPDATE บน `lastTriggeredAt` (DB เป็น distributed lock, กัน duplicate ข้าม instance)
4. สร้าง `AlertEvent` → ส่ง push ทุกอุปกรณ์ → บันทึก `NotificationLog` ต่อเครื่อง
5. SW แสดง notification → คลิกแล้วเปิดหน้าหุ้น; subscription 404/410 ถูกลบทิ้ง

### ข้อจำกัดเสียง (สำคัญ — ต้องสื่อสารกับผู้ใช้ตรง ๆ)

- เสียง custom เล่นเฉพาะเมื่อ **แอปเปิดอยู่ (foreground)** และผู้ใช้เคยโต้ตอบกับหน้าแล้ว (autoplay policy)
- เมื่อแอปอยู่**เบื้องหลัง** OS จะใช้**เสียง notification ของระบบ** — ไม่มีทางการันตีไฟล์ MP3 custom ทุกอุปกรณ์
- iOS PWA ใช้เสียงระบบเสมอ; Android Chrome ควบคุมเสียงไม่ได้จาก payload
- ระบบนี้ fallback เป็น system sound อัตโนมัติ และแสดง Browser Limitation Notice ในหน้า Sounds แล้ว

## 📊 การวิเคราะห์ในตัว (Built-in Analysis Engine — builtin-v1)

ระบบ**วิเคราะห์เองทั้งหมดในเซิร์ฟเวอร์ของคุณ** — ไม่ใช้ AI ภายนอก ไม่มี Colab/Ollama/API key เพิ่มเติม:

1. **Worker เก็บราคาสะสม** — ทุกรอบ poll (ตลาดเปิด) บันทึก `PriceSample` ของทุกหุ้นที่มี Alert ไว้ (เก็บย้อนหลัง ~3 วัน)
2. **แนะนำราคาเข้าอัตโนมัติ** — หน้าสร้าง Alert กดปุ่ม **"ให้ระบบวิเคราะห์"** ระบบคำนวณ SMA(5/20), โมเมนตัม, RSI(14), ความผันผวน, ตำแหน่งราคาในกรอบวัน → เติมราคาเป้าหมาย + เงื่อนไข (≥/≤) ให้เอง พร้อม stop/target/confidence — **ผู้ใช้ไม่ต้องกำหนดราคาเอง**
3. **สรุปใน notification** — เปิด `analyzeOnTrigger` แล้วเมื่อ Alert trigger push จะแนบ "📊 สรุป + จุดเข้าแนะนำใหม่"
4. **ประวัติ** — ทุกการวิเคราะห์เก็บในตาราง `Analysis` แสดงในหน้าหุ้น

### หลักการตัดสิน (deterministic, conservative)

| สัญญาณ | บวก (ไปทาง BUY) | ลบ (ไปทาง AVOID) |
|---|---|---|
| SMA 5 vs 20 | สั้น > กลาง | สั้น < กลาง |
| RSI(14) | < 30 (oversold) | > 70 (overbought) |
| โมเมนตัม vs ค่าเฉลี่ยช่วงก่อน | ≤ −2% | ≥ +5% |
| ตำแหน่งในกรอบวัน | ≤ 25% (ใกล้จุดต่ำ) | ≥ 85% (ใกล้จุดสูง) |

score ≥ 2 → **BUY** · score ≤ −2 → **AVOID** · ที่เหลือ → **WAIT** (ค่าเริ่มต้นคือ "รอ" — ไม่เดา)
จุดเข้า = ราคาปัจจุบัน − 0.5×ATR-like · stop = −1.5× · target = +2.5× (ATR-like จาก stdev ราคา, ขั้นต่ำ 0.5%)

### ข้อจำกัด (สำคัญ)

- Engine ใช้เฉพาะราคาที่ worker เก็บสะสม — หุ้นใหม่จะยังไม่มีข้อมูลพอ (ต้องมี ≥ minSamples = 12 จุด ≈ 12 นาทีตลาดเปิด) ช่วงแรกผลจะเป็น WAIT เป็นหลัก
- ใช้ intraday history เท่านั้น ไม่ใช้งบการเงิน/ข่าว — **ผลวิเคราะห์เป็นข้อมูลประกอบเท่านั้น ไม่ใช่คำแนะนำการลงทุน**
- ทุกอย่างรันในเซิร์ฟเวอร์คุณ ไม่มีข้อมูลออกภายนอก และ analysis ล้มเหลว = alert pipeline ทำงานปกติ

## Background Worker และ Serverless

Worker ปกติ (`npm run worker`) เป็น long-running process — เหมาะกับ VPS/Docker/Railway/Render/Fly

**Vercel/Serverless ไม่มี long-running process** จึงให้เรียก `POST /api/cron/run-poll` ด้วย header
`Authorization: Bearer <CRON_SECRET>` ทุก 1 นาที (Vercel Cron / GitHub Actions / UptimeRobot)
— ดู `vercel.json` ที่แนบมาในโปรเจกต์

## Deploy

### Docker (แนะนำสำหรับเริ่มต้น)

```bash
docker compose up -d --build
# app ที่ http://localhost:3000 — migrate + seed รันอัตโนมัติ
```

### Render (แนะนำ — มี Blueprint ใน repo แล้ว)

**วิธีที่ 1: Blueprint (อัตโนมัติทั้ง DB + Web + Worker)**

1. Push repo นี้ขึ้น GitHub (มี `render.yaml`)
2. Render Dashboard → **New → Blueprint** → เลือก repo
3. Render จะ provision Postgres + Web Service + Worker และ wire `DATABASE_URL` ให้อัตโนมัติ
4. กรอกค่าที่ถาม: `AUTH_SECRET` (จาก `openssl rand -base64 32`), VAPID keys (จาก `npx web-push generate-vapid-keys`)
5. Deploy เสร็จ → แก้ `NEXT_PUBLIC_APP_URL` เป็น URL จริง → **Manual Deploy** อีกครั้ง (NEXT_PUBLIC ต้อง rebuild)

> ⚠️ ข้อผิดพลาดที่พบบ่อย: `P1012: Environment variable not found: DATABASE_URL` ตอน deploy
> = service ยังไม่มี env var นี้ ให้ไปที่ Service → **Environment** → เพิ่ม `DATABASE_URL`
> (คัดลอกจากหน้า Postgres instance → Internal Database URL) แล้ว redeploy
> ถ้าใช้ Blueprint จะถูกตั้งให้อัตโนมัติผ่าน `fromDatabase`

**วิธีที่ 2: Manual (Docker runtime)**

1. New → **PostgreSQL** → สร้าง DB แล้วคัดลอก **Internal Database URL**
2. New → **Web Service** → เชื่อม repo → Runtime: **Docker**
3. ก่อนกด Create: เพิ่ม Environment Variables ให้ครบตามตารางข้างบน (`DATABASE_URL` ใส่ Internal URL ที่คัดลอกไว้)
4. Web Service อีกตัว (หรือ Background Worker) สำหรับ worker:
   - Docker Command: `npx tsx worker/index.ts`
   - Env เดียวกัน (`DATABASE_URL`, `MARKET_DATA_PROVIDER`, `POLLING_INTERVAL_SECONDS`)

### Vercel

1. Import repo → ตั้ง env ทั้งหมดจาก .env.example (+CRON_SECRET)
2. `NEXT_PUBLIC_APP_URL=https://yourdomain.com`
3. เพิ่ม Vercel Cron ชี้ที่ /api/cron/run-poll (ดู vercel.json)
4. ใช้ Postgres ภายนอก (Neon/Supabase) — อย่ารัน worker บน Vercel

### Railway / Render / Fly.io / VPS

- Deploy เป็น 2 services จาก Dockerfile เดียวกัน: `npm run start` (app) และ `npm run worker` (worker)
- Railway/Render: ตั้ง env ใน dashboard; Render มี Background Worker type โดยตรง
- VPS: `docker compose up -d` + reverse proxy (Caddy/Nginx) + **ต้องเป็น HTTPS** ไม่งั้น push ใช้ไม่ได้

### เช็กลิสต์ Production

- [ ] `MARKET_DATA_PROVIDER` เป็น provider จริง (ไม่ใช่ mock)
- [ ] VAPID keys ตั้งค่าแล้ว
- [ ] `AUTH_SECRET` สุ่มใหม่
- [ ] HTTPS enabled (จำเป็นสำหรับ Service Worker และ Push)
- [ ] `NEXT_PUBLIC_APP_URL` ตรงกับโดเมนจริง
- [ ] Worker deploy แยก หรือ cron secret ตั้งค่าแล้ว

## API

ดูสรุปครบใน `ARCHITECTURE.md` §9 — ทุก endpoint คืน `{ ok, data }` / `{ ok:false, error }` เสมอ
