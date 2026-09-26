import Image from "next/image";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");

/** Server component: iOS download button — enabled only when the .ipa exists. */
function IpaDownloadButton() {
  const ipaPath = path.join(DOWNLOADS_DIR, "StockAlert-release.ipa");
  const available = existsSync(ipaPath);
  const sizeMb = available ? Math.round(statSync(ipaPath).size / 1024 / 1024) : 0;

  if (available) {
    return (
      <div className="mt-5">
        <a
          href="/downloads/StockAlert-release.ipa"
          download
          className="inline-flex items-center gap-3 rounded-2xl bg-neutral-100 px-7 py-3.5 text-base font-bold text-neutral-950 shadow-lg transition hover:bg-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          ดาวน์โหลดสำหรับ iOS (.ipa) · ~{sizeMb} MB
        </a>
      </div>
    );
  }
  return (
    <div className="mt-5">
      <span className="inline-flex cursor-not-allowed items-center gap-3 rounded-2xl border border-neutral-700 bg-neutral-900 px-7 py-3.5 text-base font-bold text-neutral-500">
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
        ดาวน์โหลดสำหรับ iOS (.ipa)
      </span>
      <p className="mt-2 text-sm text-amber-500/90">
        ⏳ ไฟล์ .ipa กำลังเตรียม build ผ่าน Apple/Expo EAS — ปุ่มจะใช้งานได้อัตโนมัติเมื่อไฟล์พร้อม
      </p>
    </div>
  );
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stock Alert — แจ้งเตือนหุ้น/ETF ในเครื่องคุณ",
  description:
    "แอปมือถือติดตามราคาหุ้น/ETF พร้อมแจ้งเตือนเมื่อราคาถึงเงื่อนไข — ทำงานในเครื่อง 100% ไม่ต้องสมัครสมาชิก ดาวน์โหลด APK สำหรับ Android",
};

const FEATURES = [
  {
    icon: "📊",
    title: "ภาพรวมแบบเรียลไทม์",
    text: "ดูราคาล่าสุด สถานะตลาดสหรัฐ (เปิด/ปิด/ก่อนเปิด) และสรุป Alert ที่เฝ้าอยู่ ในหน้าเดียว",
  },
  {
    icon: "🔔",
    title: "แจ้งเตือนตามเงื่อนไข",
    text: "สร้าง Alert ได้ไม่จำกัด — ราคาขึ้นถึง/ลงถึงเป้าหมาย, แบบครั้งเดียว, ตั้ง cooldown กันเตือนรัว",
  },
  {
    icon: "🔊",
    title: "เสียงแจ้งเตือนของคุณเอง",
    text: "มี 4 เสียงในตัว หรือนำเข้าไฟล์เสียงจากเครื่อง (mp3/wav/m4a) — เก็บในเครื่อง ไม่อัปโหลดขึ้นเซิร์ฟเวอร์",
  },
  {
    icon: "🤖",
    title: "วิเคราะห์ราคาแนะนำ",
    text: "เอนจิน builtin-v1 ชี้จุดเข้า จุดตัดขาดทุน และเป้าหมาย พร้อมเหตุผลประกอบ (ไม่ใช่คำแนะนำการลงทุน)",
  },
  {
    icon: "🌐",
    title: "ราคาจริงจาก Yahoo Finance",
    text: "ดึงราคาตลาดจริง (อาจหน่วง ~15 นาที) ผ่าน Yahoo Finance — ฐานข้อมูลและการแจ้งเตือนเก็บในเครื่อง ไม่ต้องสมัครสมาชิก",
  },
  {
    icon: "🌙",
    title: "ดีไซน์ดาร์กคมชัด",
    text: "ธีมมืดทั้งแอป ดูสบายตา ใช้ได้ทั้งมือถือและแท็บเล็ต (iPad รองรับเต็มจอ)",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 font-extrabold text-neutral-950">S</span>
          <span className="text-lg font-bold">Stock Alert</span>
        </div>
        <a
          href="#download"
          className="rounded-full border border-neutral-700 px-4 py-1.5 text-sm text-neutral-300 transition hover:border-emerald-500 hover:text-emerald-400"
        >
          ดาวน์โหลด
        </a>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-10 text-center">
        <p className="mb-4 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-sm text-emerald-400">
          🆕 เวอร์ชัน 2.1.0 — ราคาจริงจาก Yahoo Finance · แจ้งเตือนทันที
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          ติดตามหุ้น & ETF
          <span className="text-emerald-400"> แจ้งเตือนทันทีที่ราคาถึงเป้า</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-neutral-400">
          แอปมือถือดึงราคาจริงจาก Yahoo Finance พร้อมแจ้งเตือนทันที — ไม่ต้องสมัครสมาชิก ไม่มีบัญชี
          ข้อมูลทั้งหมดเก็บในเครื่อง ดาวน์โหลดติดตั้งแล้วใช้ได้เลย
        </p>

        {/* Download buttons */}
        <div id="download" className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href="/downloads/StockAlert-release.apk"
            download
            className="flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 text-lg font-bold text-neutral-950 shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400 sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
              <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.7-.26-.85-.29-.15-.65-.06-.83.22l-1.88 3.24a11.43 11.43 0 00-8.94 0L5.65 5.67c-.19-.29-.58-.38-.87-.2-.28.18-.37.54-.22.83L6.4 9.48A10.81 10.81 0 001 18h22a10.81 10.81 0 00-5.4-8.52zM7 15.25a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5zm10 0a1.25 1.25 0 110-2.5 1.25 1.25 0 010 2.5z" />
            </svg>
            ดาวน์โหลดสำหรับ Android (.apk)
          </a>
          <a
            href="#ios"
            className="flex w-full max-w-xs items-center justify-center gap-3 rounded-2xl border border-neutral-700 px-8 py-4 text-lg font-bold text-neutral-200 transition hover:border-neutral-500 sm:w-auto"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            สำหรับ iPhone / iPad
          </a>
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          เวอร์ชัน 2.1.0 · รองรับ Android 7.0+ (arm64 / armv7 / x86) · ขนาดไฟล์ ~88 MB
        </p>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="text-center text-2xl font-bold sm:text-3xl">ครบทุกฟังก์ชันที่ต้องมี</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 transition hover:border-emerald-500/40">
              <div className="text-3xl">{f.icon}</div>
              <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How to install */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl border border-neutral-800 bg-gradient-to-b from-neutral-900/80 to-neutral-950 p-8 sm:p-10">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">ติดตั้งง่าย ๆ ใน 3 ขั้นตอน</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
              { n: "1", t: "ดาวน์โหลด APK", d: "กดปุ่มดาวน์โหลดด้านบนจากมือถือ Android" },
              { n: "2", t: "อนุญาตการติดตั้ง", d: "เปิดไฟล์ที่ดาวน์โหลด แล้วยืนยัน \"ติดตั้งจากแหล่งที่ไม่รู้จัก\"" },
              { n: "3", t: "เปิดใช้ได้เลย", d: "ไม่มีสมัครสมาชิก ไม่มี login — เปิดปุ๊บใช้ปั๊บ" },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-xl font-extrabold text-neutral-950">
                  {s.n}
                </div>
                <h3 className="mt-4 font-bold">{s.t}</h3>
                <p className="mt-1 text-sm text-neutral-400">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* iOS section */}
      <section id="ios" className="mx-auto max-w-5xl px-6 py-10">
        <div className="rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 sm:p-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-neutral-800">
              <svg viewBox="0 0 24 24" className="h-8 w-8 fill-neutral-100" aria-hidden>
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold sm:text-2xl">เวอร์ชัน iOS / iPad (.ipa)</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                โค้ดรองรับ iOS และ iPad ครบทุกฟังก์ชัน (ฐานข้อมูล/เสียง/การแจ้งเตือน ทำงานในเครื่องเหมือน Android ทุกประการ)
              </p>

              {/* IPA download — file is optional; show availability dynamically */}
              <IpaDownloadButton />

              <ul className="mt-4 space-y-1 text-sm text-neutral-500">
                <li>• รองรับ iPhone (iOS 15+) และ iPad แบบเต็มจอ</li>
                <li>• การติดตั้งไฟล์ .ipa บนเครื่องจริงต้องใช้เครื่อง Mac (Apple Configurator/Xcode) หรือผ่าน TestFlight</li>
                <li>• ไฟล์ .ipa ไม่สามารถติดตั้งตรง ๆ บน iPhone ได้เหมือน APK — ต้องผ่านเครื่องมือของ Apple เสมอ</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* API note */}
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-2">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6 text-sm text-neutral-500">
          <strong className="text-neutral-300">สำหรับนักพัฒนา:</strong> เซิร์ฟเวอร์นี้ยังเปิด REST API ให้เรียกใช้ได้
          <code className="mx-1 rounded bg-neutral-800 px-1.5 py-0.5 text-emerald-400">GET /api/health</code>·
          <code className="mx-1 rounded bg-neutral-800 px-1.5 py-0.5 text-emerald-400">GET /api/system/status</code>
          (แอปมือถือเวอร์ชันใหม่ไม่ได้ใช้ API เหล่านี้แล้ว — ทำงานในเครื่องเองทั้งหมด)
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-900 py-8 text-center text-sm text-neutral-600">
        <div className="flex items-center justify-center gap-2">
          <Image src="/icons/icon-192.png" alt="Stock Alert" width={20} height={20} className="rounded" />
          <span>Stock Alert · แจ้งเตือนหุ้นในเครื่องของคุณ</span>
        </div>
        <p className="mt-2">ข้อมูลราคาจาก Yahoo Finance (อาจหน่วง ~15 นาที) — ไม่ใช่คำแนะนำการลงทุน</p>
      </footer>
    </main>
  );
}
