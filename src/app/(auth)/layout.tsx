import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-4 py-10 dark:bg-neutral-950">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-xl font-bold text-white">S</div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">Stock Alert PWA</h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">ติดตามราคาหุ้น/ETF สหรัฐฯ พร้อมระบบแจ้งเตือนตามเงื่อนไข</p>
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-neutral-400 dark:text-neutral-600">
          ระบบนี้เป็นการแจ้งเตือนตามเงื่อนไขของผู้ใช้เท่านั้น ไม่ใช่คำแนะนำการลงทุน และไม่รับประกันผลกำไร
        </p>
      </div>
    </div>
  );
}
