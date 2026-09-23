"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Input, Label } from "@/components/ui";
import { useToast } from "@/components/ui/toast";

export default function ProfileSettingsPage() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [savingName, setSavingName] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<{
    currentPassword: string; newPassword: string; confirm: string;
  }>();

  useEffect(() => {
    apiFetch<{ user: { name: string; email: string } }>("/api/auth/me")
      .then((d) => {
        setName(d.user.name);
        setEmail(d.user.email);
      })
      .catch(() => undefined);
  }, []);

  const saveName = async () => {
    setSavingName(true);
    try {
      await apiFetch("/api/auth/me", { method: "PATCH", body: JSON.stringify({ name }) });
      toast.push("success", "บันทึกชื่อแล้ว");
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = handleSubmit(async (values) => {
    if (values.newPassword !== values.confirm) {
      toast.push("error", "รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
      });
      toast.push("success", "เปลี่ยนรหัสผ่านสำเร็จ — อุปกรณ์อื่นถูกออกจากระบบแล้ว");
      reset();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">โปรไฟล์และความปลอดภัย</h1>

      <Card>
        <CardHeader title="ข้อมูลส่วนตัว" />
        <CardBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">ชื่อ</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>อีเมล</Label>
              <p className="text-sm text-neutral-500">{email || "…"}</p>
              <p className="mt-1 text-xs text-neutral-400">อีเมลใช้เข้าสู่ระบบ — ปัจจุบันยังไม่เปิดให้แก้ไข</p>
            </div>
            <Button onClick={saveName} disabled={savingName || name.trim().length < 2}>
              {savingName ? "กำลังบันทึก…" : "บันทึกชื่อ"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="เปลี่ยนรหัสผ่าน" subtitle="หลังเปลี่ยน อุปกรณ์อื่นทุกเครื่องจะถูกออกจากระบบ" />
        <CardBody>
          <form onSubmit={changePassword} className="space-y-4" noValidate>
            <div>
              <Label htmlFor="cur">รหัสผ่านปัจจุบัน</Label>
              <Input id="cur" type="password" autoComplete="current-password" {...register("currentPassword", { required: true })} />
              {errors.currentPassword ? <p className="mt-1 text-xs text-red-600">กรุณากรอกรหัสผ่านปัจจุบัน</p> : null}
            </div>
            <div>
              <Label htmlFor="new">รหัสผ่านใหม่</Label>
              <Input id="new" type="password" autoComplete="new-password" {...register("newPassword", {
                required: true,
                minLength: { value: 8, message: "อย่างน้อย 8 ตัวอักษร" },
                pattern: { value: /^(?=.*[a-zA-Z])(?=.*\d).*$/, message: "ต้องมีทั้งตัวอักษรและตัวเลข" },
              })} />
              {errors.newPassword ? <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p> : null}
            </div>
            <div>
              <Label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</Label>
              <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm", { required: true })} />
              {errors.confirm ? <p className="mt-1 text-xs text-red-600">กรุณายืนยันรหัสผ่าน</p> : null}
            </div>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "กำลังบันทึก…" : "เปลี่ยนรหัสผ่าน"}</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
