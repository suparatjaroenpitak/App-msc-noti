# Stock Alert PWA — System Architecture

> ระบบแจ้งเตือนราคาหุ้น/ETF สหรัฐฯ ตามเงื่อนไขผู้ใช้ — ไม่ใช่คำแนะนำการลงทุน และไม่รับประกันผลกำไร

---

## 1. System Overview

แอปพลิเคชันเว็บแบบ SaaS Dashboard ที่ผู้ใช้สามารถ:

- สมัครสมาชิก / เข้าสู่ระบบ / จัดการบัญชี
- ค้นหาหุ้นและ ETF สหรัฐฯ (Symbol / Company Name)
- เพิ่มหุ้นเข้า Watchlist และดูราคาล่าสุดแบบเรียลไทม์ (poll)
- สร้าง Price Alert หลายเงื่อนไข (ABOVE_OR_EQUAL / BELOW_OR_EQUAL)
- ได้รับ Web Push Notification ผ่าน Service Worker + VAPID
- ปรับแต่งเสียงแจ้งเตือน (เสียงระบบ / อัปโหลดเสียงเอง) พร้อม Fallback ชัดเจน
- ดูประวัติการแจ้งเตือน และติดตั้งเป็น PWA บน Android / iOS / Desktop

องค์ประกอบหลัก 4 ส่วน:

1. **Next.js App (SSR/CSR + REST API)** — UI, Auth, CRUD
2. **Background Worker** — ดึงราคา ตรวจเงื่อนไข ยิง Push (deploy แยกได้)
3. **PostgreSQL + Prisma** — Source of truth
4. **Market Data Providers** — Twelve Data / Alpha Vantage / Finnhub / Mock (dev only) ซ่อนหลัง Interface เดียว

## 2. Functional Requirements

| # | ฟีเจอร์ | รายละเอียด |
|---|---------|-----------|
| F1 | Auth | Register, Login, Logout, Forgot/Reset Password, Change Password, Session |
| F2 | Asset Search | Debounced search, Recent, Favorite, Exchange/Type/Currency |
| F3 | Quote | ราคาปัจจุบัน, change, %change, high/low, prevClose, volume |
| F4 | Watchlist | เพิ่ม/ลบ/เรียงลำดับ, นับ Alert ต่อหุ้น, เปิดหน้ารายละเอียด |
| F5 | Alerts | CRUD + enable/disable/duplicate/pause/resume/test, ENTRY/EXIT/CUSTOM |
| F6 | Worker | Poll ทุก POLLING_INTERVAL_SECONDS, dedupe symbol, เช็คเงื่อนไข, cooldown, retry |
| F7 | Push | Web Push + VAPID, หลายอุปกรณ์/ผู้ใช้, subscribe/unsubscribe, test, ลบ subscription หมดอายุ |
| F8 | Sound | Default sounds, upload/preview/rename/delete, ผูกเสียงตามประเภท Alert, Fallback system sound |
| F9 | History | AlertEvent + NotificationLog พร้อมหน้า UI |
| F10 | PWA | Installable, offline fallback, update notification, /install guide |
| F11 | Preferences | push/entry/exit/custom toggles, default sound, volume |

## 3. Non-Functional Requirements

- **Security**: bcrypt (cost 12) password hashing, HttpOnly/SameSite=Lax Secure cookie session (opaque token hashed ลง DB), Zod validation ทุก input, Prisma parameterized query (กัน SQL Injection), React escaping (กัน XSS), ownership check ทุก resource (กัน IDOR), rate limiting per-IP/user, ไม่ส่ง API key ไป frontend
- **Reliability**: Idempotent alert trigger (DB transaction + conditional update `lastTriggeredAt`), cooldown, retry with backoff ต่อ provider, error แยกต่อ symbol, graceful shutdown
- **Performance**: Dedupe symbol ก่อนยิง API, index ครบตาม query path, skeleton loading
- **Compatibility**: Mobile-first responsive, Dark/Light mode, keyboard accessible, PWA ทุก platform
- **Maintainability**: Strict TypeScript, Interface-based provider (แก้ provider ไม่ต้องแก้ business logic), แยก layer: route → service → data
- **Deployability**: Worker แยก process ได้ (`npm run worker`), Docker Compose, คำอธิบาย serverless constraint

## 4. System Architecture

```
                        ┌──────────────────────────────────────────────┐
                        │                 Browsers / PWA               │
                        │  React UI ─ Service Worker ─ PushManager     │
                        └─────────────▲───────────────────┬──────────┘
                        REST (fetch)  │                   │ push (web-push)
                                      │                   ▼
┌─────────────────────┐   ┌───────────┴────────────────────────────────────┐
│  Market Data        │   │           Next.js (App Router)                 │
│  Providers          │   │  ┌────────────────┐  ┌───────────────────────┐ │
│ ┌─────────────────┐ │   │  │ Pages (RSC/CC) │  │ Route Handlers (REST) │ │
│ │ Twelve Data     │◄┼───┼──│ Quote/Search   │  │ auth/assets/watchlist │ │
│ │ Alpha Vantage   │ │   │  └────────────────┘  │ alerts/push/sounds/...│ │
│ │ Finnhub         │ │   │                      └──────────┬────────────┘ │
│ │ Mock (dev only) │ │   │  lib/auth  lib/security  lib/validation        │
│ └─────────────────┘ │   └─────────────────────────────────┬────────────┘
└─────────────────────┘                                     │ Prisma
                                                            ▼
                                              ┌──────────────────────────┐
                                              │       PostgreSQL         │
                                              │ Users, Assets, Watchlist │
                                              │ AlertRules, AlertEvents  │
                                              │ PushSubs, Sounds, Logs   │
                                              └──────────▲───────────────┘
                                                         │ Prisma
┌──────────────────────┐  quotes   ┌─────────────────────┴────────────┐
│ Market Data Providers│◄──────────│      Background Worker           │
│ (same interface)     │           │ market-poller → alert-engine     │
└──────────────────────┘           │ cooldown / retry / dedupe        │
                    web-push       │ graceful shutdown                │
            ┌──────────────────────┤ (npm run worker หรือ cron route) │
            └─────────────────────►│ sends push via VAPID             │
                                   └──────────────────────────────────┘
```

**Provider Interface (กลาง):**

```ts
interface MarketDataProvider {
  getQuote(symbol: string): Promise<StockQuote>;
  searchAssets(keyword: string): Promise<AssetSearchResult[]>;
}
```

`lib/market-data/index.ts` เลือก provider จาก `MARKET_DATA_PROVIDER` — business logic ไม่รู้จัก provider โดยตรง

## 5. Data Flow

**5.1 ผู้ใช้สร้าง Alert → ได้รับแจ้งเตือน**

```
UI ──POST /api/alerts (Zod validated, session checked)──► AlertRule (DB)
Worker ทุก 60s:
  1. ดึง AlertRule ที่ enabled พร้อม Asset ที่ active อยู่ในช่วง market hours
  2. Group by symbol → ดึง quote ครั้งเดียวต่อ symbol (dedupe + cache + retry/backoff)
  3. ต่อ rule: เช็ค cooldown (lastTriggeredAt + cooldownMinutes > now → skip)
  4. เงื่อนไขจริง → UPDATE AlertRule SET lastTriggeredAt=now() WHERE id=? AND (lastTriggeredAt IS NULL OR lastTriggeredAt <= :cooldownWindow)
     — conditional update = idempotency lock กรณี worker หลาย instance (DB เป็น distributed lock)
  5. ถ้า update affects=1 → สร้าง AlertEvent + ส่ง push ทุก subscription ของ user (ตาม NotificationPreference + sound)
  6. บันทึก NotificationLog ต่อ subscription (SENT / FAILED + errorMessage)
  7. oneTime → disable rule หลังส่งสำเร็จ
```

**5.2 Push ฝั่ง client**

```
UI request permission → register /sw.js → pushManager.subscribe(VAPID public)
→ POST /api/push/subscribe → เก็บ endpoint+p256dh+auth ลง PushSubscription
Worker/Route → web-push.sendNotification → SW 'push' event → showNotification
→ คลิก notification → openWindow /assets/[symbol]
```

**5.3 Custom Sound**

- เปิดแอปอยู่: `Audio`/Web Audio API เล่นไฟล์เสียงเมื่อ push event มาถึง (หลัง user interaction แล้ว — กัน autoplay policy)
- แอปอยู่เบื้องหลัง: SW แสดง notification ด้วย system sound เป็นหลัก OS จะกำหนดเอง — **แจ้ง Browser Limitation Notice ในหน้า Sounds และ Settings ชัดเจน ไม่โฆษณาว่าเล่นได้ 100%**

## 6. Database ERD

```
User 1───1 NotificationPreference
User 1───* PushSubscription
User 1───* NotificationSound        (defaultSoundId → NotificationSound, SET NULL)
User 1───* Watchlist ──*───1 Asset
User 1───* AlertRule ──*───1 Asset
User 1───* AlertRule ──0..1──NotificationSound (soundId, SET NULL)
AlertRule 1───* AlertEvent
AlertEvent 1───* NotificationLog
User 1───* NotificationLog
PushSubscription 1───* NotificationLog (SET NULL)
```

Key constraints:

- `Asset.symbol` UNIQUE (uppercase)
- `Watchlist (userId, assetId)` UNIQUE, `AlertRule (userId, assetId, name)` UNIQUE
- `PushSubscription.endpoint` UNIQUE
- ทุก FK มี cascade ตามความเหมาะสม (ลบ User → ลบข้อมูลทั้งหมดของ user)
- ราคาเป็น `Decimal(12,4)`; timestamps เป็น UTC (`@db.Timestamptz`)

## 7. Prisma Schema

ดูไฟล์จริงที่ `prisma/schema.prisma` (สร้างใน Phase 3)

## 8. Folder Structure

```
stock-alert-pwa/
├── app/
│   ├── (auth)/login, register, forgot-password, reset-password
│   ├── (dashboard)/dashboard, watchlist, assets/[symbol],
│   │                alerts, alerts/create, alerts/[id]/edit,
│   │                notifications, notification-sounds, settings/*
│   ├── api/            # Route Handlers ตาม section 13
│   ├── install/        # คู่มือติดตั้ง PWA
│   ├── manifest.webmanifest/route.ts
│   ├── layout.tsx, globals.css, page.tsx (redirect)
│   └── actions/        # ตัวอย่าง cron endpoint อยู่ใน api/
├── components/ (ui, dashboard, watchlist, alerts, notifications, sounds, layout)
├── lib/ (auth, db, market-data, notifications, push, validation, security, worker)
├── prisma/ (schema.prisma, seed.ts)
├── public/ (icons, sounds, sw.js, offline.html)
├── worker/ (index.ts, market-poller.ts, alert-engine.ts)
├── hooks/ (use-push, use-market-status, use-sound, use-theme ...)
├── types/ (market.ts, index.ts)
├── tests/ (unit, e2e)
├── Dockerfile, docker-compose.yml, .env.example, README.md, ARCHITECTURE.md
```

## 9. API Design (สรุป — Response format เดียวกันทั้งระบบ)

**Response envelope:** `{ ok: true, data }` | `{ ok: false, error: { code, message, details? } }`
**Auth:** Session cookie `stock_alert_session` (HttpOnly, Secure, SameSite=Lax) — กัน CSRF ด้วย SameSite + ตรวจ Origin บน mutation

| Method | Path | Auth | คำอธิบาย | Rate Limit |
|---|---|---|---|---|
| POST | /api/auth/register | – | สมัครสมาชิก (bcrypt) | 5/10min/IP |
| POST | /api/auth/login | – | เข้าสู่ระบบ | 10/10min/IP |
| POST | /api/auth/logout | ✔ | ลบ session | – |
| GET | /api/auth/me | ✔ | โปรไฟล์ | – |
| PATCH | /api/auth/me | ✔ | เปลี่ยนชื่อ | – |
| PATCH | /api/auth/password | ✔ | เปลี่ยนรหัสผ่าน | 5/h |
| POST | /api/auth/forgot-password | – | สร้าง reset token | 3/h/IP |
| POST | /api/auth/reset-password | – | รีเซ็ตด้วย token | 5/h/IP |
| GET | /api/assets/search?q= | ✔ | ค้นหา (debounce ฝั่ง UI) | 60/min |
| GET | /api/assets/:symbol | ✔ | ข้อมูล asset | – |
| GET | /api/market/quote/:symbol | ✔ | ราคาล่าสุด (cache 30s) | 120/min |
| GET/POST | /api/watchlist | ✔ | ดู/เพิ่ม | – |
| DELETE | /api/watchlist/:id | ✔ | ลบ (ownership check) | – |
| PATCH | /api/watchlist/reorder | ✔ | เรียงลำดับ | – |
| GET/POST | /api/alerts | ✔ | รายการ/สร้าง | – |
| GET/PATCH/DELETE | /api/alerts/:id | ✔ | ดู/แก้/ลบ (ownership) | – |
| POST | /api/alerts/:id/enable\|disable\|duplicate\|test | ✔ | จัดการ alert | test 10/h |
| GET | /api/alert-history | ✔ | AlertEvent ของ user | – |
| POST | /api/push/subscribe, /unsubscribe | ✔ | จัดการ subscription | – |
| GET | /api/push/status | ✔ | รายการอุปกรณ์ + สถานะ VAPID | – |
| POST | /api/push/test | ✔ | ส่ง test notification | 10/h |
| GET/PATCH | /api/notification-preferences | ✔ | ตั้งค่าการแจ้งเตือน | – |
| GET/POST | /api/notification-sounds | ✔ | คลังเสียง / อัปโหลด (MIME+ext+size+duration, random storage key) | upload 10/h |
| PATCH/DELETE | /api/notification-sounds/:id | ✔ | เปลี่ยนชื่อ/ลบ (ownership) | – |
| POST | /api/notification-sounds/:id/activate | ✔ | ตั้ง default | – |
| GET | /api/notification-history | ✔ | NotificationLog ของ user | – |
| GET | /api/health, /api/system/status | – | health / worker+provider status | – |
| POST | /api/cron/run-poll | secret | เรียก worker จาก scheduler ภายนอก (Vercel Cron) | secret header |

## 10. Development Roadmap

| Phase | เนื้อหา | สถานะ |
|---|---|---|
| 1 | Architecture + DB design + เอกสารนี้ | ✅ |
| 2 | Next.js scaffold, Tailwind, TS strict, deps, env | ✅ |
| 3 | Prisma schema + seed (10 assets + default sounds) | ✅ |
| 4 | Auth (session, register/login/reset), security, validation, market-data providers | ✅ |
| 4b | REST API ทั้งหมด | ✅ |
| 5 | Dashboard/Watchlist/Asset detail/Alerts UI | ✅ |
| 6 | PWA manifest + SW + offline + install guide | ✅ |
| 7 | Web Push ครบวงจร (VAPID, subscribe, test) | ✅ |
| 8 | Worker (poller, alert engine, cooldown, retry, cron route) | ✅ |
| 9 | Custom sound (upload, library, assignment, fallback notice) | ✅ |
| 10 | Vitest unit + Playwright E2E | ✅ (โครง + test หลัก) |
| 11 | Docker, README, deployment guide | ✅ |

## ข้อจำกัดสำคัญที่ต้องยอมรับตรง ๆ

1. **เสียงแจ้งเตือนระบบ**: เมื่อแอปอยู่เบื้องหลัง OS จะใช้เสียง notification ของระบบ — custom MP3 ไม่การันตีทุกอุปกรณ์ (Android Chrome รองรับ `silent:false` เท่านั้น; iOS PWA ใช้เสียงระบบเสมอ)
2. **Worker บน Serverless**: Vercel ไม่มี long-running process — ใช้ `/api/cron/run-poll` + Vercel Cron, หรือ deploy worker แยกบน Railway/Render/Fly/VPS ด้วย `npm run worker`
3. **ราคาจริง**: Mock provider เฉพาะ `MARKET_DATA_PROVIDER=mock` (development) — production ต้องใส่ API key จริง
4. **Push บน iOS**: ต้องติดตั้งเป็น PWA (Add to Home Screen) และ iOS ≥ 16.4 จึงจะได้ `PushManager`
