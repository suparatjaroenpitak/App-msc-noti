import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { api } from "../api/client";
import { useApi, errorMessage } from "../hooks/useApi";
import { Badge, Button, Card, EmptyState, ErrorBanner, Screen, SectionTitle, Spinner } from "../components/ui";
import type { AlertActionResult, AlertRow } from "../api/types";
import type { RootStackParamList } from "../navigation/types";
import { colors, spacing } from "../theme";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function AlertsScreen() {
  const navigation = useNavigation<Nav>();
  const { data, error, loading, reload } = useApi<{ alerts: AlertRow[] }>("/api/alerts");
  const [busyId, setBusyId] = useState<string | null>(null);

  const alerts = data?.alerts ?? [];

  const runAction = async (id: string, action: "enable" | "disable" | "duplicate" | "test") => {
    setBusyId(id);
    try {
      const result = await api<AlertActionResult>(`/api/alerts/${id}/actions`, {
        method: "POST",
        body: { action },
      });
      return result;
    } catch (err) {
      Alert.alert("ทำรายการไม่สำเร็จ", errorMessage(err));
      return null;
    } finally {
      setBusyId(null);
    }
  };

  const toggle = async (alert: AlertRow, value: boolean) => {
    await runAction(alert.id, value ? "enable" : "disable");
    reload();
  };

  const sendTest = async (alert: AlertRow) => {
    const result = await runAction(alert.id, "test");
    if (!result) return;
    if (result.reason) {
      Alert.alert("ยังไม่ได้ส่ง", result.reason);
    } else if ((result.sent ?? 0) > 0) {
      Alert.alert("ทดสอบแล้ว", "🔔 เล่นเสียงแจ้งเตือนทดสอบในเครื่องแล้ว (โหมด offline ไม่มี push — ดูประวัติได้ในหน้า ประวัติการแจ้งเตือน)");
    } else {
      Alert.alert("ทดสอบไม่สำเร็จ", "ลองอีกครั้ง หรือตรวจเสียงในหน้า คลังเสียง");
    }
    reload();
  };

  const remove = (alert: AlertRow) => {
    Alert.alert(`ลบ Alert "${alert.name}"?`, "ประวัติการแจ้งเตือนที่เกี่ยวข้องจะถูกลบไปด้วย", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/alerts/${alert.id}`, { method: "DELETE" });
            reload();
          } catch (err) {
            Alert.alert("ลบไม่สำเร็จ", errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <View style={styles.headerRow}>
        <SectionTitle subtitle={`${alerts.filter((a) => a.enabled).length} active / ${alerts.length} ทั้งหมด`}>
          Price Alerts
        </SectionTitle>
        <Button title="+ สร้าง" size="sm" onPress={() => navigation.navigate("AlertForm", {})} />
      </View>

      <ErrorBanner message={error} />
      <Card>
        {loading && data === null ? (
          <Spinner />
        ) : alerts.length === 0 ? (
          <EmptyState title="ยังไม่มี Alert" description="กดปุ่ม “+ สร้าง” เพื่อตั้งเงื่อนไขราคาแรก" />
        ) : (
          alerts.map((alert, index) => (
            <View key={alert.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Switch
                value={alert.enabled}
                onValueChange={(value) => void toggle(alert, value)}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor="#fff"
                disabled={busyId === alert.id}
              />
              <Pressable
                style={{ flex: 1 }}
                onPress={() => navigation.navigate("AlertForm", { id: alert.id })}
              >
                <View style={styles.rowInline}>
                  <Text style={styles.symbol}>{alert.asset.symbol}</Text>
                  <Badge
                    text={alert.type}
                    tone={alert.type === "ENTRY" ? "green" : alert.type === "EXIT" ? "red" : "gray"}
                  />
                  {alert.oneTime ? <Badge text="One-time" tone="amber" /> : null}
                </View>
                <Text style={styles.name} numberOfLines={1}>
                  {alert.name}
                </Text>
                <Text style={styles.muted}>
                  ราคา {alert.condition === "ABOVE_OR_EQUAL" ? "≥" : "≤"} ${Number(alert.targetPrice).toFixed(2)} ·
                  cooldown {alert.cooldownMinutes} นาที{alert.sound ? ` · 🔊 ${alert.sound.name}` : ""}
                </Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable onPress={() => void sendTest(alert)} hitSlop={8} disabled={busyId === alert.id}>
                  <Text style={styles.actionText}>ทดสอบ</Text>
                </Pressable>
                <Pressable onPress={() => remove(alert)} hitSlop={8}>
                  <Text style={styles.delete}>ลบ</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>
      <Text style={styles.hint}>แตะที่รายการเพื่อแก้ไข · สวิตช์เปิด/ปิดการใช้ Alert</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  rowInline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  symbol: { color: colors.text, fontWeight: "800" },
  name: { color: colors.text, fontSize: 13, fontWeight: "600", marginTop: 2 },
  muted: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  actions: { alignItems: "flex-end", gap: spacing.xs },
  actionText: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  delete: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  hint: { color: colors.textFaint, fontSize: 11 },
});
