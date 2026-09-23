"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { Button, Input, Label, Card, CardBody } from "@/components/ui";
import { apiFetch, ApiClientError } from "@/lib/api/client";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [devToken, setDevToken] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string }>();

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setMessage(null);
    setDevToken(null);
    try {
      const res = await apiFetch<{ message: string; devToken?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setMessage(res.message);
      if (res.devToken) setDevToken(res.devToken);
    } catch (e) {
      setMessage(e instanceof ApiClientError ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  });

  return (
    <Card>
      <CardBody className="space-y-5">
        <h2 className="text-lg font-semibold">ลืมรหัสผ่าน</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          กรอกอีเมลที่สมัครไว้ ระบบจะสร้างลิงก์รีเซ็ตรหัสผ่าน (Production จะส่งอีเมล — Development จะแสดง token ให้ทดสอบ)
        </p>
        {message ? <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{message}</div> : null}
        {devToken ? (
          <div className="rounded-lg bg-neutral-100 px-3 py-2 text-xs break-all dark:bg-neutral-800">
            Dev token: <code className="break-all">{devToken}</code>
            <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`} className="ml-2 text-emerald-600 hover:underline">
              ไปหน้าตั้งรหัสผ่านใหม่
            </Link>
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" type="email" {...register("email", { required: true })} />
            {errors.email ? <p className="mt-1 text-xs text-red-600">กรุณากรอกอีเมล</p> : null}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "กำลังส่ง…" : "ส่งคำขอรีเซ็ต"}
          </Button>
        </form>
        <p className="text-center text-sm">
          <Link href="/login" className="text-emerald-600 hover:underline dark:text-emerald-400">
            กลับไปเข้าสู่ระบบ
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
