"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Chrome, Smartphone, Monitor, ChevronRight } from "lucide-react";

type Platform = "android" | "ios" | "desktop";

export default function InstallPage() {
  const [platform, setPlatform] = useState<Platform>("desktop");
  const [standalone, setStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<{ prompt: () => Promise<void> } | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform("ios");
    else if (/Android/i.test(ua)) setPlatform("android");
    else setPlatform("desktop");

    setStandalone(window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as unknown as { prompt: () => Promise<void> });
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">← กลับ Dashboard</Link>
      <h1 className="mt-4 text-2xl font-bold">ติดตั้ง Stock Alert เป็นแอป</h1>
      <p className="mt-1 text-sm text-neutral-500">
        ติดตั้งเป็น PWA เพื่อรับ Push Notification และใช้งานแบบ full-screen
        {standalone ? " — แอปติดตั้งอยู่แล้ว ✅" : ""}
      </p>

      {!standalone && installPrompt ? (
        <button
          onClick={() => void installPrompt.prompt()}
          className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          ติดตั้งเดี๋ยวนี้ (1 คลิก)
        </button>
      ) : null}

      {/* Platform tabs */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {([
          ["android", "Android", Smartphone],
          ["ios", "iPhone/iPad", Smartphone],
          ["desktop", "Desktop", Monitor],
        ] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setPlatform(key)}
            className={`rounded-xl border p-3 text-center text-sm font-medium ${
              platform === key
                ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                : "border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Icon className="mx-auto mb-1 h-5 w-5" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {platform === "android" ? (
          <Steps
            title="Android — Google Chrome"
            steps={[
              "เปิดเว็บไซต์นี้ด้วย Chrome",
              "แตะเมนู ⋮ ที่มุมขวาบน",
              "เลือก “ติดตั้งแอป” หรือ “Add to Home screen”",
              "ยืนยันการติดตั้ง — ไอคอนจะปรากฏบนหน้าจอหลัก",
              "เปิดแอปจากหน้าจอหลัก แล้วเปิด Push Notification ในหน้า Settings",
            ]}
            note="Push Notification ทำงานเต็มรูปแบบบน Android Chrome"
          />
        ) : null}

        {platform === "ios" ? (
          <Steps
            title="iPhone / iPad — Safari"
            steps={[
              "เปิดเว็บไซต์นี้ด้วย Safari (ไม่รองรับบน Chrome ของ iOS)",
              "แตะปุ่ม Share (ลูกศรขึ้น)",
              "เลื่อนหา “Add to Home Screen”",
              "แตะ “Add” เพื่อติดตั้ง",
              "เปิดแอปจากหน้าจอหลัก แล้วเปิด Push Notification (ต้องเป็น iOS 16.4+)",
            ]}
            note="Push บน iOS ทำงานเฉพาะเมื่อติดตั้งเป็น PWA แล้วเท่านั้น"
          />
        ) : null}

        {platform === "desktop" ? (
          <>
            <Steps
              title="Desktop — Google Chrome"
              steps={[
                "คลิกไอคอน Install (⊕) ที่มุมขวาของ address bar",
                "หรือเมนู ⋮ → “Install Stock Alert…”",
                "ยืนยัน — แอปจะเปิดในหน้าต่างแยก",
              ]}
              note="Push ทำงานแม้ปิดแท็บ ตราบใดที่ Chrome ทำงานอยู่"
            />
            <Steps
              title="Desktop — Microsoft Edge"
              steps={[
                "คลิกไอคอน “Apps” หรือเมนู … → Apps → “Install this site as an app”",
                "ยืนยันการติดตั้ง",
                "เปิดจาก Start Menu ได้เลย",
              ]}
            />
          </>
        ) : null}
      </div>

      <p className="mt-8 text-xs text-neutral-400">
        หมายเหตุ: การแจ้งเตือนจะทำงานเมื่อคุณเปิดใช้ Push ในหน้า Settings → การแจ้งเตือน และเบราว์เซอร์ได้รับอนุญาตให้แสดง Notification
      </p>
    </div>
  );
}

function Steps({ title, steps, note }: { title: string; steps: string[]; note?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="flex items-center gap-2 font-semibold">
        <Chrome className="h-4 w-4" /> {title}
      </h2>
      <ol className="mt-3 space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
      {note ? <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{note}</p> : null}
    </div>
  );
}
