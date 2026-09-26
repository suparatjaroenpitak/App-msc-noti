import React, { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError, registerRequest } from "../api/client";
import { useAuth } from "../auth";
import { Button, Input, Screen, SectionTitle } from "../components/ui";
import { colors, spacing } from "../theme";

export function RegisterScreen() {
  const { login } = useAuth();
  const [mode, setMode] = useState<"register" | "forgot">("register");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState<string>("https://stock-alert-web.onrender.com");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submitRegister = async () => {
    setError(null);
    setNotice(null);
    if (name.trim().length < 2) {
      setError("กรุณากรอกชื่ออย่างน้อย 2 ตัวอักษร");
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข");
      return;
    }
    setBusy(true);
    try {
      await registerRequest(name.trim(), email.trim(), password, serverUrl);
      // registerRequest already persisted the token; refresh auth context via login() with the same
      // credentials so the context state is consistent.
      await login(email.trim(), password, serverUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { forgotPasswordRequest } = await import("../api/client");
      const res = await forgotPasswordRequest(email.trim());
      if (res.devToken) {
        setNotice(`โหมดพัฒนา: ใช้รหัสรีเซ็ตนี้ในหน้าถัดไป — ${res.devToken}`);
      } else {
        setNotice("ถ้าอีเมลนี้มีบัญชีอยู่ ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมล (ตรวจสอบกล่องจดหมาย)");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "ส่งคำขอรีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Text style={styles.logo}>S</Text>
      <Text style={styles.title}>{mode === "register" ? "สมัครสมาชิก" : "ลืมรหัสผ่าน"}</Text>
      <Text style={styles.subtitle}>ติดตามราคาหุ้น/ETF และรับ Alert จากมือถือ</Text>

      <View style={styles.card}>
        {mode === "register" ? (
          <>
            <Text style={styles.label}>ชื่อ</Text>
            <Input value={name} onChangeText={setName} placeholder="ชื่อของคุณ" autoCapitalize="words" />
          </>
        ) : null}

        <Text style={styles.label}>อีเมล</Text>
        <Input value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />

        {mode === "register" ? (
          <>
            <Text style={styles.label}>รหัสผ่าน</Text>
            <Input value={password} onChangeText={setPassword} placeholder="อย่างน้อย 8 ตัว มีตัวเลขและตัวอักษร" secureTextEntry />
          </>
        ) : null}

        <Text style={styles.label}>เซิร์ฟเวอร์ (API URL)</Text>
        <Input value={serverUrl} onChangeText={setServerUrl} placeholder="https://your-server.onrender.com" keyboardType="url" autoCapitalize="none" />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Button
          title={busy ? "กำลังดำเนินการ…" : mode === "register" ? "สมัครสมาชิก" : "ส่งคำขอรีเซ็ตรหัสผ่าน"}
          onPress={mode === "register" ? submitRegister : submitForgot}
          disabled={busy}
        />

        {busy ? <ActivityIndicator style={{ marginTop: spacing.sm }} color={colors.primary} /> : null}
      </View>

      <View style={styles.switchRow}>
        <Pressable
          onPress={() => {
            setMode(mode === "register" ? "forgot" : "register");
            setError(null);
            setNotice(null);
          }}
        >
          <Text style={styles.switchText}>
            {mode === "register" ? "มีบัญชีอยู่แล้ว? เข้าสู่ระบบที่หน้าก่อน — หรือ ลืมรหัสผ่าน?" : "กลับไปหน้าสมัครสมาชิก"}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: {
    alignSelf: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontSize: 34,
    fontWeight: "800",
    color: colors.primary,
    backgroundColor: colors.card,
    width: 64,
    height: 64,
    borderRadius: 16,
    textAlign: "center",
    textAlignVertical: "center",
    overflow: "hidden",
  },
  title: { textAlign: "center", color: colors.text, fontSize: 22, fontWeight: "800" },
  subtitle: { textAlign: "center", color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs, marginTop: spacing.sm },
  error: { color: "#f87171", marginTop: spacing.sm },
  notice: { color: colors.primary, marginTop: spacing.sm },
  switchRow: { alignItems: "center", marginTop: spacing.md },
  switchText: { color: colors.primary, fontSize: 13 },
});
