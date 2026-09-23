"use client";

import Link from "next/link";
import { Bell, Download, ShieldCheck, User, Activity, Bot } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui";
import { useSystemStatus } from "@/hooks/use-market-status";

export default function SettingsPage() {
  const { status } = useSystemStatus();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="grid gap-4">
        <Link href="/settings/profile" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800"><User className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="font-semibold">โปรไฟล์และความปลอดภัย</p>
                <p className="text-sm text-neutral-500">เปลี่ยนชื่อ, เปลี่ยนรหัสผ่าน</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-neutral-400" />
            </CardBody>
          </Card>
        </Link>

        <Link href="/settings/notifications" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800"><Bell className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="font-semibold">การแจ้งเตือน</p>
                <p className="text-sm text-neutral-500">Push, ประเภท Alert, เสียงเริ่มต้น, ระดับเสียง</p>
              </div>
              <Bell className="h-5 w-5 text-neutral-400" />
            </CardBody>
          </Card>
        </Link>

        <Link href="/settings/ai" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40"><Bot className="h-5 w-5 text-blue-600 dark:text-blue-300" /></div>
              <div className="flex-1">
                <p className="font-semibold">AI วิเคราะห์หุ้น (Ollama on Colab)</p>
                <p className="text-sm text-neutral-500">เชื่อมต่อ Ollama ของคุณ ให้ AI แนะนำราคาเข้า</p>
              </div>
              <Bot className="h-5 w-5 text-neutral-400" />
            </CardBody>
          </Card>
        </Link>

        <Link href="/install" className="block">
          <Card className="transition-shadow hover:shadow-md">
            <CardBody className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800"><Download className="h-5 w-5" /></div>
              <div className="flex-1">
                <p className="font-semibold">ติดตั้งแอป (PWA)</p>
                <p className="text-sm text-neutral-500">Android, iPhone, Desktop Chrome/Edge</p>
              </div>
              <Download className="h-5 w-5 text-neutral-400" />
            </CardBody>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader title="สถานะระบบ" subtitle="ตรวจสอบการเชื่อมต่อและผู้ให้บริการข้อมูลราคา" />
        <CardBody className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-neutral-500">Database</span><span>{status ? (status.db ? "✅ ปกติ" : "❌ ผิดพลาด") : "…"}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Market Data Provider</span><span>{status ? `${status.marketDataProvider} ${status.marketDataProviderHealthy ? "✅" : "❌"}` : "…"}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">Push (VAPID)</span><span>{status ? (status.pushConfigured ? "✅ ตั้งค่าแล้ว" : "⚠️ ยังไม่ได้ตั้งค่า") : "…"}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500">ตลาดสหรัฐฯ</span><span>{status?.market.label ?? "…"}</span></div>
        </CardBody>
      </Card>

      <p className="flex items-center gap-2 text-xs text-neutral-400">
        <Activity className="h-3.5 w-3.5" />
        ระบบแจ้งเตือนตามเงื่อนไขของผู้ใช้ — ไม่ใช่คำแนะนำการลงทุน
      </p>
    </div>
  );
}
