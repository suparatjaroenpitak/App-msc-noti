"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button, Input, Label, Card, CardBody } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/api/client";

function ResetForm() {
  const router = useRouter();
  const toast = useToast();
  const search = useSearchParams();
  const token = search.get("token") ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<{ password: string }>();

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password: values.password }) });
      toast.push("success", "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบอีกครั้ง");
      router.push("/login");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "รีเซ็ตไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  });

  return (
    <Card>
      <CardBody className="space-y-5">
        <h2 className="text-lg font-semibold">ตั้งรหัสผ่านใหม่</h2>
        {!token ? (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">ลิงก์ไม่ถูกต้อง (ไม่พบ token)</div>
        ) : null}
        {error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</div> : null}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="password">รหัสผ่านใหม่</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register("password", {
              required: true,
              minLength: { value: 8, message: "อย่างน้อย 8 ตัวอักษร" },
              pattern: { value: /^(?=.*[a-zA-Z])(?=.*\d).*$/, message: "ต้องมีทั้งตัวอักษรและตัวเลข" },
            })} />
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading || !token}>
            {loading ? "กำลังบันทึก…" : "ตั้งรหัสผ่านใหม่"}
          </Button>
        </form>
        <p className="text-center text-sm">
          <Link href="/login" className="text-emerald-600 hover:underline dark:text-emerald-400">กลับไปเข้าสู่ระบบ</Link>
        </p>
      </CardBody>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
