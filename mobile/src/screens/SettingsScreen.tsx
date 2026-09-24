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
  const { user, serverUrl, setServerUrl, logout } = useAuth();
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
      Alert.alert("บันทึกแล้ว", "เปลี่ยนเซิร์ฟเวอร์แล้ว — กรุณาเข้าสู่ระบบใหม่");
      await logout();
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

  const confirmLogout = () => {
    Alert.alert("ออกจากระบบ?", "ต้องเข้าสู่ระบบใหม่ในครั้งถัดไป", [
      { text: "ยกเลิก", style: "cancel" },
      { text: "ออกจากระบบ", style: "destructive", onPress: () => void logout() },
    ]);
  };

  return (
    <Screen refreshing={prefs.loading || status.loading} onRefresh={() => { prefs.reload(); status.reload(); }}>
      <SectionTitle subtitle={user?.email}>{user?.name ?? "บัญชีของฉัน"}</SectionTitle>

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
        <Muted>การเปลี่ยนเซิร์ฟเวอร์จะออกจากระบบอัตโนมัติ (token ผูกกับเซิร์ฟเวอร์เดิม)</Muted>
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
        <Pressable onPress={() => navigation.navigate("Sounds")}>
          <Text style={styles.link}>🔊 จัดการเสียงแจ้งเตือน →</Text>
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

      <SectionTitle>บัญชี</SectionTitle>
      <Card>
        <Button title="ออกจากระบบ" variant="danger" onPress={confirmLogout} />
        <Muted>Stock Alert Mobile v{APP_VERSION} · ใช้ API ชุดเดียวกับเว็บ PWA</Muted>
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
});
