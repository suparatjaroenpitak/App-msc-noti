"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button, Input, Label, Card, CardBody } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiClientError } from "@/lib/api/client";

type RegisterForm = { name: string; email: string; password: string };

export default function RegisterPage() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>();

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setFormError(null);
    try {
      await apiFetch("/api/auth/register", { method: "POST", body: JSON.stringify(values) });
      toast.push("success", "สมัครสมาชิกสำเร็จ — ยินดีต้อนรับ!");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setFormError(e instanceof ApiClientError ? e.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  });

  return (
    <Card>
      <CardBody className="space-y-5">
        <h2 className="text-lg font-semibold">สมัครสมาชิก</h2>
        {formError ? (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {formError}
          </div>
        ) : null}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="name">ชื่อ</Label>
            <Input id="name" autoComplete="name" placeholder="ชื่อของคุณ" {...register("name", { required: "กรุณากรอกชื่อ", minLength: { value: 2, message: "อย่างน้อย 2 ตัวอักษร" } })} />
            {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="email">อีเมล</Label>
            <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" {...register("email", { required: "กรุณากรอกอีเมล" })} />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email.message}</p> : null}
          </div>
          <div>
            <Label htmlFor="password">รหัสผ่าน</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="อย่างน้อย 8 ตัว มีทั้งตัวอักษรและตัวเลข"
              {...register("password", {
                required: "กรุณากรอกรหัสผ่าน",
                minLength: { value: 8, message: "อย่างน้อย 8 ตัวอักษร" },
                pattern: { value: /^(?=.*[a-zA-Z])(?=.*\d).*$/, message: "ต้องมีทั้งตัวอักษรและตัวเลข" },
              })}
            />
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
          </div>
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? "กำลังสมัคร…" : "สมัครสมาชิก"}
          </Button>
        </form>
        <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
          มีบัญชีแล้ว?{" "}
          <Link href="/login" className="text-emerald-600 hover:underline dark:text-emerald-400">
            เข้าสู่ระบบ
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
