# Stock Alert PWA

> ติดตามราคาหุ้นและ ETF สหรัฐฯ พร้อมระบบแจ้งเตือนตามเงื่อนไขของผู้ใช้
> **ไม่ใช่คำแนะนำการลงทุน และไม่รับประกันผลกำไร**

Next.js App Router · TypeScript Strict · Tailwind CSS · Prisma · SQLite · Web Push (VAPID) · PWA

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
mobile/             # แอป Android (React Native/Expo) — ดู mobile/README.md
```

## แอป Android (React Native)

มีแอปมือถือสำหรับ Android ในโฟลเดอร์ `mobile/` (Expo + TypeScript) ใช้ API ชุดเดียวกับเว็บ
โดยยืนยันตัวตนผ่าน Bearer token:

- `POST /api/auth/token` — แลก email + password เป็น token (ตาราง Session เดียวกับ cookie login)
- ทุก endpoint ของเว็บรองรับ `Authorization: Bearer <token>` แล้ว
- ฟีเจอร์: Login, Dashboard, Watchlist, Alerts (เปิด/ปิด/ทดสอบ/สร้าง/แก้ไข/ลบ), เสียงแจ้งเตือน, ตั้งค่า
- ยังไม่รวม native push (FCM) — ดู `mobile/README.md`

Build APK (คลาวด์ ไม่ต้องติดตั้ง Android SDK):

```bash
cd mobile
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform android --profile preview   # ได้ไฟล์ .apk
```

## เริ่มต้น (Development)

```bash
# 1) ติดตั้ง dependencies
npm install

# 2) ตั้งค่า environment
cp .env.example .env
#   - DATABASE_URL ชี้ที่ไฟล์ SQLite (default: file:./dev.db → prisma/dev.db) — สร้างเองอัตโนมัติ
#   - สร้าง AUTH_SECRET: openssl rand -base64 32
#   - สร้าง VAPID keys: npx web-push generate-vapid-keys

# 3) สร้าง DB + seed (SQLite — ใช้ migration ที่มีใน repo ได้เลย)
npx prisma migrate dev
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
# SQLite อยู่ที่ /app/data (docker volume "appdata") — app + worker รวมใน container เดียว
```

### Render (แนะนำ — มี Blueprint ใน repo แล้ว)

**วิธีที่ 1: Blueprint (อัตโนมัติทั้ง DB + Web + Worker)**

1. Push repo นี้ขึ้น GitHub (มี `render.yaml`)
2. Render Dashboard → **New → Blueprint** → เลือก repo
3. Render จะ provision Web Service (Docker) — migrate + seed + app + worker รวมใน container เดียว (SQLite ในตัว ไม่มี Postgres)
4. กรอกค่าที่ถาม: `AUTH_SECRET` (จาก `openssl rand -base64 32`), VAPID keys (จาก `npx web-push generate-vapid-keys`)
5. Deploy เสร็จ → แก้ `NEXT_PUBLIC_APP_URL` เป็น URL จริง → **Manual Deploy** อีกครั้ง (NEXT_PUBLIC ต้อง rebuild)

> ⚠️ ข้อผิดพลาดที่พบบ่อยบน Render
>
> **P1012: Environment variable not found: DATABASE_URL** — service ยังไม่มี env var นี้
> ไปที่ Service → **Environment** → เพิ่ม `DATABASE_URL` (เช่น `file:/app/data/stock-alert.db`) แล้ว redeploy
>
> **P3009: migrate found failed migrations** — เคยมี migration รันแล้วล้มค้างอยู่ใน DB
> ทำให้ migration ใหม่ไม่ถูก apply แก้ได้ 2 ทาง:
>
> **ทาง 1 (DB ยังไม่มีข้อมูลจริง — แนะนำ): ให้ deploy ซ่อมตัวเอง** — start command ของ image ใช้ `scripts/safe-migrate.mjs`
> ที่จับ P3009 แล้ว ลบไฟล์ SQLite + apply migration ใหม่ให้เองเมื่อเปิด flag:
> ```text
> Render → Service → Environment → เพิ่ม:
>   DB_AUTO_RECOVER = true     (ลบไฟล์ SQLite + migrate ใหม่ — ข้อมูลใน DB หายหมด!)
>   FRESH_DB_SEED  = true      (seed ข้อมูลเริ่มต้น demo user + assets)
> แล้วกด Save Changes → redeploy → พอ deploy ผ่านแล้ว "ลบสองตัวแปรนี้ทิ้ง" ทันที
> ```
>
> **ทาง 2: รันจากเครื่องคุณเอง** (เมื่อไม่อยาก redeploy):
> ```bash
> DATABASE_URL="file:./dev.db" sh scripts/reset-migrations.sh
> ```
>
> **ทาง 3 (DB มีข้อมูลจริงแล้ว — ห้าม reset):** mark migration ที่ fail แล้ว deploy ใหม่:
> ```bash
> npx prisma migrate resolve --rolled-back <ชื่อ-migration-ที่-fail>
> ```
> (ดู https://pris.ly/d/migrate-resolve)
>
> **⚠️ กับดักที่พบจริง: วางคำสั่งทั้งบรรทัดลงช่อง DATABASE_URL**
> ถ้า log แสดงชื่อ database เพี้ยน เช่น `database "msc_stock%20sh%20scripts/reset-migrations.sh"`
> แปลว่ามีคนวาง `DATABASE_URL="..." sh scripts/reset-migrations.sh` ทั้งบรรทัดลงช่อง Environment Variable
> บน Render — **ช่อง DATABASE_URL ให้ใส่แค่ URL เท่านั้น** เช่น
> `file:/app/data/stock-alert.db` (ตัด `"` และคำสั่งอื่นออกทั้งหมด)
>
> **Deploy ค้างนาน ~15 นาที แล้วจบด้วย "Port scan timeout reached, no open ports detected"**
> build ผ่านแต่ `safe-migrate: prisma migrate deploy` เงียบไปตลอด = migrate เชื่อมต่อ DB ไม่ได้และค้าง
> จนหมดเวลา port scan (server ไม่เคยได้สตาร์ท) สาเหตุที่พบบ่อย:
>
> 1. **โฟลเดอร์ของไฟล์ SQLite เขียนไม่ได้** — /app/data ต้องเขียนได้โดย user "app" ใน container (ตรวจ mount/disk)
> 2. **DATABASE_URL ผิดรูปแบบ** — ต้องขึ้นด้วย `file:` เช่น `file:/app/data/stock-alert.db`
> 3. **P3009 migration ค้าง** — ตั้ง `DB_AUTO_RECOVER=true` (ลบไฟล์ DB — ข้อมูลหาย!) แล้ว redeploy
>
> สคริปต์ deploy มี preflight + timeout ฝังไว้แล้ว: ถ้าไฟล์ DB เขียนไม่ได้ จะ fail ทันทีพร้อมข้อความบอกสาเหตุ
> แทนที่จะแขวนนิ่ง 15 นาที (ปรับเวลาได้: `MIGRATE_TIMEOUT_SECONDS`, `SEED_TIMEOUT_SECONDS`)

**วิธีที่ 2: Manual (Docker runtime)**

1. New → **Web Service** → เชื่อม repo → Runtime: **Docker** — Blueprint นี้ไม่ต้องสร้าง Postgres แล้ว
2. ก่อนกด Create: เพิ่ม Environment Variables ให้ครบ (`DATABASE_URL` = `file:/app/data/stock-alert.db`)
3. ⚠️ **SQLite อยู่ใน filesystem ของ container — ข้อมูลจะหายทุกครั้งที่ deploy บนแผน free**
   (ต้องการ persist จริง: อัปเกรดเป็น paid plan แล้วเพิ่ม Render Disk mount ที่ `/app/data`)
4. worker รวมอยู่ใน container เดียวกันแล้วผ่าน `RUN_WORKER_IN_WEB=true` (SQLite แชร์ไฟล์ข้าม container ไม่ได้)

### Vercel

1. Import repo → ตั้ง env ทั้งหมดจาก .env.example (+CRON_SECRET)
2. `NEXT_PUBLIC_APP_URL=https://yourdomain.com`
3. เพิ่ม Vercel Cron ชี้ที่ /api/cron/run-poll (ดู vercel.json)
4. ใช้ SQLite ร่วมกับ cron ได้ แต่ไฟล์ DB บน serverless อาจถูกรีเซ็ต — ถ้าต้องการ persist จริงให้ mount volume/แยก host ที่เก็บไฟล์ (อย่ารัน worker long-running บน Vercel)

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

## Landing Page + ดาวน์โหลด APK

หน้าแรกของเว็บ (`/`) เป็น landing page สำหรับดาวน์โหลดแอป:

- ปุ่ม **ดาวน์โหลดสำหรับ Android (.apk)** → `/downloads/StockAlert-release.apk`
  - เสิร์ฟผ่าน route `src/app/downloads/[file]/route.ts` (Content-Type ถูกต้อง + Content-Disposition ชื่อไฟล์สวย)
  - ไฟล์จริงอยู่ที่ `public/downloads/StockAlert-release.apk` — **อัปเดตด้วยการ copy ทับจาก `mobile/apk/` หลัง build ใหม่ทุกครั้ง:**
    ```bash
    cp "mobile/apk/StockAlert-release.apk" "public/downloads/StockAlert-release.apk"
    ```
  - ถ้าไฟล์ยังไม่ถูก copy route จะตอบ 404 พร้อมข้อความบอก
- ปุ่ม **iPhone / iPad** พาไปส่วนอธิบายสถานะ iOS (TestFlight) บนหน้าเดียวกัน
- หมายเหตุ API สำหรับนักพัฒนาอยู่ท้ายหน้า (เว็บยังเสิร์ฟ API เดิมครบ)

## ไฟล์ .ipa (iOS)

- สั่ง build ผ่าน EAS แล้ว (บัญชี `asdrt009s-team`, project `stock-alert-mobile`)
- build ปัจจุบันเป็น **iOS Simulator build** (ฟรี) → ได้ `StockAlert.app` แพ็กเป็น `Payload/` zip = `.ipa`
- วางไฟล์ที่ `public/downloads/StockAlert-release.ipa` → ปุ่มดาวน์โหลดบน landing page เปิดใช้อัตโนมัติ
- สั่ง build ใหม่:
  ```bash
  export EXPO_TOKEN=<token ของคุณ>
  cd mobile   # (หรือ C:\acbuild\mobile สำหรับ build path ASCII)
  eas build --platform ios --profile ios-simulator --non-interactive
  # ดาวน์โหลดผลจากลิงก์ที่โชว์ (tar.gz ข้างในมี StockAlert.app) แล้วแพ็ก:
  # mkdir Payload && cp -r StockAlert.app Payload/ && zip -qry StockAlert-release.ipa Payload
  # cp StockAlert-release.ipa public/downloads/
  ```
- ติดตั้ง: .ipa แบบ simulator ใช้กับ iOS Simulator บน Mac เท่านั้น — ติดตั้งเครื่อง iPhone จริงต้องมี Apple Developer ($99/ปี) แล้ว build ด้วย profile `production`

## แหล่งราคา (v1.3.0+)

- **จำลอง (default)** — ราคาสุ่มในเครื่อง ทำงาน offline 100% (ไม่ใช่ราคาจริง)
- **ราคาจริง** — เปิดได้ใน ตั้งค่า → แหล่งราคา → toggle "ใช้ราคาตลาดจริง"
  - ดึงจาก Yahoo Finance chart API (ฟรี ไม่ต้องมี key, อาจหน่วง ~15 นาทีตามตลาด)
  - ต้องต่อเน็ต · cache 1 นาที/symbol · ถ้าโหลดไม่ได้จะ fallback เป็นราคาจำลองอัตโนมัติ
  - เก็บค่า preference ใน SQLite (ตาราง kv)
