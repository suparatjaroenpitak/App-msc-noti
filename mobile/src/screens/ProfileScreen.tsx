import React, { useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "../api/client";
import { errorMessage } from "../hooks/useApi";
import { useAuth } from "../auth";
import { Button, Card, Input, Screen, SectionTitle } from "../components/ui";
import type { Preferences } from "../api/types";
import { colors, spacing } from "../theme";

export function ProfileScreen() {
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [volume, setVolume] = useState<number | null>(null);
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const prefsLoaded = volume !== null;

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    setSavingName(true);
    try {
      const res = await api<{ user: { id: string; name: string; email: string; image: string | null } }>(
        "/api/auth/me",
        { method: "PATCH", body: { name: trimmed } },
      );
      if (setUser && res.user) setUser({ id: res.user.id, name: res.user.name, email: res.user.email });
      Alert.alert("สำเร็จ", "บันทึกชื่อใหม่แล้ว");
    } catch (err) {
      Alert.alert("บันทึกไม่สำเร็จ", errorMessage(err));
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (newPassword.length < 8 || !/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      Alert.alert("รหัสผ่านใหม่ไม่ผ่านเงื่อนไข", "ต้องมีอย่างน้อย 8 ตัวอักษร ประกอบด้วยตัวอักษรและตัวเลข");
      return;
    }
    setSavingPassword(true);
    try {
      await api("/api/auth/password", {
        method: "POST",
        body: { currentPassword, newPassword },
      });
      Alert.alert("สำเร็จ", "เปลี่ยนรหัสผ่านแล้ว — อุปกรณ์อื่นทุกเครื่องจะถูกออกจากระบบ", [
        { text: "ตกลง", onPress: () => void logout() },
      ]);
    } catch (err) {
      Alert.alert("เปลี่ยนรหัสผ่านไม่สำเร็จ", errorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const loadPrefs = async () => {
    try {
      const res = await api<{ preferences: Preferences }>("/api/notification-preferences");
      setVolume(res.preferences.volume);
      setPushEnabled(res.preferences.pushEnabled);
    } catch {
      // silent — switches stay hidden
    }
  };
  void loadPrefs();

  const savePrefs = async (patch: Partial<Pick<Preferences, "volume" | "pushEnabled">>) => {
    try {
      await api("/api/notification-preferences", { method: "PATCH", body: patch });
    } catch (err) {
      Alert.alert("บันทึกไม่สำเร็จ", errorMessage(err));
    }
  };

  return (
    <Screen>
      <SectionTitle subtitle={user?.email}>โปรไฟล์ของฉัน</SectionTitle>
      <Card>
        <Text style={styles.label}>ชื่อที่แสดง</Text>
        <Input value={name} onChangeText={setName} autoCapitalize="words" />
        <Button title="บันทึกชื่อ" onPress={saveName} loading={savingName} disabled={savingName} variant="secondary" />
      </Card>

      <SectionTitle subtitle="ต้องใช้รหัสผ่านปัจจุบัน">เปลี่ยนรหัสผ่าน</SectionTitle>
      <Card>
        <Text style={styles.label}>รหัสผ่านปัจจุบัน</Text>
        <Input value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
        <Text style={styles.label}>รหัสผ่านใหม่</Text>
        <Input value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder="อย่างน้อย 8 ตัว มีตัวเลขและตัวอักษร" />
        <Button title="เปลี่ยนรหัสผ่าน" onPress={changePassword} loading={savingPassword} disabled={savingPassword || !currentPassword || !newPassword} />
      </Card>

      {prefsLoaded ? (
        <>
          <SectionTitle subtitle="ตั้งค่าเดียวกับเว็บ">เสียงและการแจ้งเตือน</SectionTitle>
          <Card>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>เปิดใช้ Push ทั้งหมด</Text>
              <Switch
                value={pushEnabled ?? false}
                onValueChange={(v) => {
                  setPushEnabled(v);
                  void savePrefs({ pushEnabled: v });
                }}
                trackColor={{ true: colors.primary }}
              />
            </View>
            <View style={[styles.switchRow, styles.lastRow]}>
              <Text style={styles.switchLabel}>ความดังเสียง ({Math.round((volume ?? 0.8) * 100)}%)</Text>
            </View>
            <VolumeSlider
              value={volume ?? 0.8}
              onChange={(v) => setVolume(v)}
              onSlidingComplete={(v) => void savePrefs({ volume: v })}
            />
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

/** Minimal pure-JS volume slider (0-100 steps) to avoid a native slider dependency. */
function VolumeSlider({
  value,
  onChange,
  onSlidingComplete,
}: {
  value: number;
  onChange: (v: number) => void;
  onSlidingComplete: (v: number) => void;
}) {
  const steps = 10;
  const current = Math.round(value * steps);
  return (
    <View style={styles.volumeRow}>
      {Array.from({ length: steps + 1 }, (_, i) => (
        <View
          key={i}
          style={[styles.volStep, i <= current && styles.volStepOn]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs, marginTop: spacing.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm },
  lastRow: { paddingTop: spacing.sm, paddingBottom: 0 },
  switchLabel: { color: colors.text, flex: 1, paddingRight: spacing.sm },
  volumeRow: { flexDirection: "row", gap: 4, marginTop: spacing.sm },
  volStep: { flex: 1, height: 22, borderRadius: 4, backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
  volStepOn: { backgroundColor: colors.primary, borderColor: colors.primary },
});
