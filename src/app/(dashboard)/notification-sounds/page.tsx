"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Play, Square, Trash2, Pencil, CheckCircle2, UploadCloud } from "lucide-react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { Card, CardHeader, CardBody, Button, Badge, Skeleton, EmptyState, Input, ConfirmDialog } from "@/components/ui";
import { useToast } from "@/components/ui/toast";
import { playNotificationSound, primeAudioOnUserGesture } from "@/hooks/use-sound";
import { formatDateTime } from "@/lib/utils";

type Sound = {
  id: string; name: string; fileUrl: string; mimeType: string;
  fileSize: number; duration: number | null; isDefault: boolean; createdAt: string;
};

export default function NotificationSoundsPage() {
  const toast = useToast();
  const [sounds, setSounds] = useState<Sound[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Sound | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Sound | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ sounds: Sound[] }>("/api/notification-sounds");
      setSounds(data.sounds);
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "โหลดเสียงไม่สำเร็จ");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  // Seed built-in sounds as personal library entries on first visit.
  const ensureBuiltins = useCallback(async () => {
    if (!sounds || sounds.length > 0) return;
    try {
      for (const [name, url] of [
        ["Chime (Built-in)", "/sounds/chime.wav"],
        ["Ding (Built-in)", "/sounds/ding.wav"],
        ["Alert (Built-in)", "/sounds/alert.wav"],
      ] as const) {
        const blob = await fetch(url).then((r) => r.blob());
        const form = new FormData();
        form.append("file", new File([blob], url.split("/").pop()!, { type: blob.type || "audio/wav" }));
        form.append("name", name);
        form.append("duration", "0.5");
        await apiFetch("/api/notification-sounds", { method: "POST", body: form });
      }
      await load();
    } catch {
      /* built-ins are optional */
    }
  }, [sounds, load]);

  useEffect(() => {
    void ensureBuiltins();
  }, [ensureBuiltins]);

  const onUpload = async (file: File) => {
    setUploading(true);
    try {
      // Measure duration client-side before upload.
      const duration = await new Promise<number>((resolve) => {
        const a = new Audio(URL.createObjectURL(file));
        a.onloadedmetadata = () => resolve(a.duration || 0);
        a.onerror = () => resolve(0);
      });

      const form = new FormData();
      form.append("file", file);
      form.append("duration", String(Math.round(duration * 10) / 10));
      await apiFetch("/api/notification-sounds", { method: "POST", body: form });
      toast.push("success", "อัปโหลดเสียงสำเร็จ");
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const preview = (s: Sound) => {
    primeAudioOnUserGesture();
    audioRef.current?.pause();
    const a = new Audio(s.fileUrl);
    audioRef.current = a;
    a.onended = () => setPlayingId(null);
    a.play().then(() => setPlayingId(s.id)).catch(() => {
      setPlayingId(null);
      toast.push("error", "เล่นเสียงไม่ได้ — ตรวจสอบไฟล์หรือลองโต้ตอบกับหน้าก่อน");
    });
  };

  const stop = () => {
    audioRef.current?.pause();
    setPlayingId(null);
  };

  const doRename = async () => {
    if (!renaming) return;
    setBusyAction(true);
    try {
      await apiFetch(`/api/notification-sounds/${renaming.id}`, { method: "PATCH", body: JSON.stringify({ name: renameValue }) });
      toast.push("success", "เปลี่ยนชื่อสำเร็จ");
      setRenaming(null);
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "เปลี่ยนชื่อไม่สำเร็จ");
    } finally {
      setBusyAction(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusyDelete(true);
    try {
      await apiFetch(`/api/notification-sounds/${confirmDelete.id}`, { method: "DELETE" });
      toast.push("success", "ลบเสียงแล้ว");
      setConfirmDelete(null);
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ลบไม่สำเร็จ");
    } finally {
      setBusyDelete(false);
    }
  };

  const activate = async (s: Sound) => {
    try {
      await apiFetch(`/api/notification-sounds/${s.id}/activate`, { method: "POST" });
      toast.push("success", `ตั้ง "${s.name}" เป็นเสียงเริ่มต้น`);
      await load();
    } catch (e) {
      toast.push("error", e instanceof ApiClientError ? e.message : "ตั้งค่าไม่สำเร็จ");
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Notification Sounds</h1>

      {/* Browser limitation notice — required */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
        <p className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4" /> ข้อจำกัดของเสียงแจ้งเตือนในเบราว์เซอร์</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
          <li>เสียงเล่นได้เมื่อ<strong>เปิดแอปอยู่</strong> (foreground) ผ่าน HTMLAudioElement โดยต้องมีการโต้ตอบก่อนหน้า (autoplay policy)</li>
          <li>เมื่อแอปอยู่<strong>เบื้องหลัง</strong> Service Worker แสดง Notification ได้ แต่ OS อาจใช้เสียงระบบแทนไฟล์ custom เสมอ</li>
          <li>Android/iOS/Desktop อาจบังคับใช้เสียง notification ของระบบ — ระบบจะ <strong>fallback เป็น System Sound อัตโนมัติ</strong></li>
          <li>ระบบไม่สามารถการันตีการเล่นไฟล์ custom ได้ 100% ในทุกเบราว์เซอร์และทุกอุปกรณ์</li>
        </ul>
      </div>

      {/* Upload */}
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-8 text-center">
          <UploadCloud className="h-8 w-8 text-neutral-400" />
          <p className="text-sm text-neutral-500">อัปโหลดเสียงของคุณ (MP3, WAV, OGG, M4A — ไม่เกิน 10MB, 30 วินาที)</p>
          <input
            ref={fileRef}
            type="file"
            accept=".mp3,.wav,.ogg,.m4a,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "กำลังอัปโหลด…" : "เลือกไฟล์เสียง"}
          </Button>
        </CardBody>
      </Card>

      {/* Library */}
      <Card>
        <CardHeader title="คลังเสียงของคุณ" subtitle="ตั้งเสียงเริ่มต้น หรือเลือกเสียงต่อ Alert รายตัว" />
        {sounds === null ? (
          <CardBody className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}</CardBody>
        ) : sounds.length === 0 ? (
          <EmptyState icon={<Play className="h-10 w-10" />} title="ยังไม่มีเสียง" description="อัปโหลดไฟล์ หรือรอระบบเพิ่มเสียง built-in ให้อัตโนมัติ" />
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {sounds.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                <button
                  onClick={() => (playingId === s.id ? stop() : preview(s))}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                  aria-label={playingId === s.id ? "หยุด" : "เล่นตัวอย่าง"}
                >
                  {playingId === s.id ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold">
                    {s.name}
                    {s.isDefault ? <Badge tone="green"><CheckCircle2 className="mr-1 inline h-3 w-3" />Default</Badge> : null}
                  </p>
                  <p className="text-xs text-neutral-400">
                    {s.mimeType} · {(s.fileSize / 1024).toFixed(0)} KB{s.duration ? ` · ${s.duration.toFixed(1)}s` : ""}
                  </p>
                </div>
                {s.isDefault ? null : (
                  <Button size="sm" variant="secondary" onClick={() => void activate(s)}>ตั้งเป็นค่าเริ่มต้น</Button>
                )}
                <button
                  onClick={() => { setRenaming(s); setRenameValue(s.name); }}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
                  aria-label="เปลี่ยนชื่อ"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(s)}
                  className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  aria-label="ลบ"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Rename dialog */}
      {renaming ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setRenaming(null)} aria-hidden />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-2xl bg-white p-6 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold">เปลี่ยนชื่อเสียง</h2>
            <Input
              className="mt-4"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={60}
              aria-label="ชื่อเสียงใหม่"
            />
            <div className="mt-5 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRenaming(null)}>ยกเลิก</Button>
              <Button onClick={doRename} disabled={busyAction || renameValue.trim().length === 0}>บันทึก</Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`ลบเสียง "${confirmDelete?.name ?? ""}"?`}
        description="Alert ที่ใช้เสียงนี้จะกลับไปใช้เสียงเริ่มต้นของระบบ"
        destructive
        busy={busyDelete}
        onConfirm={doDelete}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  );
}
