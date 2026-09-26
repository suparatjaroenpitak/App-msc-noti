import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { useApi, errorMessage } from "../hooks/useApi";
import { Button, Card, ErrorBanner, Input, Muted, Screen, SectionTitle, Spinner } from "../components/ui";
import type { Preferences, SystemStatus } from "../api/types";
import type { RootStackParamList } from "../navigation/types";
import { APP_VERSION } from "../config";
import { colors, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const PREFS: { key: keyof Preferences; label: string }[] = [
  { key: "pushEnabled", label: "เปิดใช้ Push ทั้งหมด (เว็บ)" },
  { key: "entryEnabled", label: "แจ้งเตือนประเภท Entry" },
  { key: "exitEnabled", label: "แจ้งเตือนประเภท Exit" },
  { key: "customEnabled", label: "แจ้งเตือนประเภท Custom" },
];

export function SettingsScreen() {
  const navigation = useNavigation<Nav>();
  const { serverUrl, setServerUrl, user } = useAuth();
  const status = useApi<SystemStatus>("/api/system/status");
  const prefs = useApi<{ preferences: Preferences }>("/api/notification-preferences");
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [savingUrl, setSavingUrl] = useState(false);
  const [savingPref, setSavingPref] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  const saveServerUrl = async () => {
    setSavingUrl(true);
    try {
      await setServerUrl(urlDraft);
      Alert.alert("บันทึกแล้ว", "เปลี่ยนเซิร์ฟเวอร์เรียบร้อย");
    } catch (err) {
      Alert.alert("บันทึกไม่สำเร็จ", errorMessage(err));
    } finally {
      setSavingUrl(false);
    }
  };

  const togglePref = async (key: keyof Preferences, value: boolean) => {
    setSavingPref(key);
    setPrefsError(null);
    try {
      const res = await api<{ preferences: Preferences }>("/api/notification-preferences", {
        method: "PATCH",
        body: { [key]: value },
      });
      prefs.setData(res);
    } catch (err) {
      setPrefsError(errorMessage(err));
    } finally {
      setSavingPref(null);
    }
  };

  return (
    <Screen refreshing={prefs.loading || status.loading} onRefresh={() => { prefs.reload(); status.reload(); }}>
      <SectionTitle subtitle={serverUrl.replace(/^https?:\/\//, "")}>การเชื่อมต่อ</SectionTitle>

      <Card>
        <Text style={styles.label}>เซิร์ฟเวอร์ (API URL)</Text>
        <Input value={urlDraft} onChangeText={setUrlDraft} keyboardType="url" placeholder="https://your-app.onrender.com" />
        <Button
          title="บันทึกเซิร์ฟเวอร์"
          size="sm"
          variant="secondary"
          loading={savingUrl}
          disabled={urlDraft.trim() === serverUrl}
          onPress={() => void saveServerUrl()}
        />
        <Muted>ไม่มีระบบบัญชี — เปลี่ยนเซิร์ฟเวอร์ได้ทันที ข้อมูลอยู่ที่เซิร์ฟเวอร์ที่เชื่อมต่อ</Muted>
      </Card>

      <SectionTitle subtitle="ตั้งค่าเดียวกับเว็บ PWA">การแจ้งเตือน</SectionTitle>
      <Card>
        {prefs.data === null && prefs.loading ? (
          <Spinner />
        ) : prefs.data ? (
          PREFS.map(({ key, label }) => (
            <View key={String(key)} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{label}</Text>
              <Switch
                value={Boolean(prefs.data?.preferences[key])}
                disabled={savingPref === key}
                onValueChange={(value) => void togglePref(key, value)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          ))
        ) : (
          <Muted>โหลดการตั้งค่าไม่สำเร็จ</Muted>
        )}
        <ErrorBanner message={prefsError ?? prefs.error} />
        <VolumeControl volume={prefs.data?.preferences.volume ?? null} onSaved={(v) => prefs.setData({ preferences: { ...prefs.data!.preferences, volume: v } })} />
        <Pressable onPress={() => navigation.navigate("Sounds")}>
          <Text style={styles.link}>🔊 จัดการเสียงแจ้งเตือน →</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("History")}>
          <Text style={styles.link}>🕘 ประวัติการแจ้งเตือน →</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Analysis")}>
          <Text style={styles.link}>🤖 วิเคราะห์ราคาแนะนำ →</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("Profile")}>
          <Text style={styles.link}>🌐 ข้อมูลเซิร์ฟเวอร์ →</Text>
        </Pressable>
      </Card>

      <SectionTitle>สถานะระบบ</SectionTitle>
      <Card>
        <StatusRow label="ฐานข้อมูล" ok={status.data?.db ?? null} />
        <StatusRow label="Push (VAPID) ฝั่งเว็บ" ok={status.data?.pushConfigured ?? null} />
        <StatusRow
          label={`แหล่งราคา (${status.data?.marketDataProvider ?? "…"})`}
          ok={status.data?.marketDataProviderHealthy ?? null}
        />
        <Muted>
          แอป Android เวอร์ชันนี้ยังไม่รองรับ push แบบ native (FCM) — จะแจ้งเตือนบนเครื่องได้เฉพาะเมื่อเพิ่ม FCM ในเฟสถัดไป
        </Muted>
      </Card>

      <SectionTitle>เกี่ยวกับ</SectionTitle>
      <Card>
        <Muted>Stock Alert Mobile v{APP_VERSION} · ไม่มีระบบล็อกอิน (auth removed)</Muted>
      </Card>
    </Screen>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={{ color: ok === null ? colors.textFaint : ok ? colors.success : colors.warning, fontWeight: "700" }}>
        {ok === null ? "…" : ok ? "✅ ปกติ" : "⚠️ มีปัญหา"}
      </Text>
    </View>
  );
}

function VolumeControl({ volume, onSaved }: { volume: number | null; onSaved: (v: number) => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (volume === null) return null;
  const save = async (v: number) => {
    setSaving(true);
    setError(null);
    try {
      const res = await api<{ preferences: Preferences }>("/api/notification-preferences", {
        method: "PATCH",
        body: { volume: v },
      });
      onSaved(res.preferences.volume);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const steps = 10;
  const current = Math.round(volume * steps);
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={styles.label}>ความดังเสียงแจ้งเตือน ({Math.round(volume * 100)}%){saving ? " · กำลังบันทึก…" : ""}</Text>
      <View style={styles.volRow}>
        {Array.from({ length: steps + 1 }, (_, i) => (
          <Pressable
            key={i}
            onPress={() => void save(i / steps)}
            style={[styles.volStep, i <= current && styles.volStepOn]}
          />
        ))}
      </View>
      <ErrorBanner message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 12 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  switchLabel: { color: colors.text, fontSize: 13, flex: 1 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  link: { color: colors.primary, fontWeight: "700", paddingVertical: spacing.sm },
  volRow: { flexDirection: "row", gap: 4, marginTop: spacing.xs },
  volStep: { flex: 1, height: 22, borderRadius: 4, backgroundColor: colors.border },
  volStepOn: { backgroundColor: colors.primary },
});
