"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button, Input, Label, Card, CardBody } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type LoginForm = { email: string; password: string };

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>();

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
      toast.push("success", "เข้าสู่ระบบสำเร็จ");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : "เข้าสู่ระบบไม่สำเร็จ";
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  });

  return (
    <Card>
      <CardBody className="space-y-5">
        <h2 className="text-lg font-semibold">เข้าสู่ระบบ</h2>
        {formError ? (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {formError}
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email", { required: "กรุณากรอกอีเมล" })} />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••" {...register("password", { required: "กรุณากรอกรหัสผ่าน" })} />
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
          </Button>
        </form>
        <div className="flex items-center justify-between text-sm">
          <Link href="/forgot-password" className="text-emerald-600 hover:underline dark:text-emerald-400">
            ลืมรหัสผ่าน?
          </Link>
          <Link href="/register" className="text-emerald-600 hover:underline dark:text-emerald-400">
            สมัครสมาชิก
          </Link>
        </div>
        <p className="rounded-lg bg-neutral-100 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
          บัญชีทดลอง: demo@example.com / demo1234 (หลังรัน seed)
        </p>
      </CardBody>
    </Card>
  );
}
