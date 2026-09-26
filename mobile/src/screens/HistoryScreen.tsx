import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useApi } from "../hooks/useApi";
import { Badge, Card, EmptyState, ErrorBanner, Screen, SectionTitle, Spinner } from "../components/ui";
import type { AlertEventDetail, NotificationLogRow, Paged } from "../api/types";
import { colors, spacing } from "../theme";

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtPrice(n: number | string): string {
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? v.toFixed(2) : String(n);
}

type AlertEventPage = { events: AlertEventDetail[] } & Paged<unknown>;
type NotificationLogPage = { logs: NotificationLogRow[] } & Paged<unknown>;

export function HistoryScreen() {
  const [tab, setTab] = useState<"triggers" | "notifications">("triggers");
  const events = useApi<AlertEventPage>("/api/alert-history?pageSize=25");
  const logs = useApi<NotificationLogPage>("/api/notification-history?pageSize=25");

  return (
    <Screen refreshing={(tab === "triggers" ? events : logs).loading} onRefresh={tab === "triggers" ? events.reload : logs.reload}>
      <SectionTitle subtitle="เหตุการณ์ Alert ที่เกิดขึ้น และการแจ้งเตือนที่ส่งไป">ประวัติ</SectionTitle>

      <View style={styles.tabRow}>
        <TabButton label="Triggers" active={tab === "triggers"} onPress={() => setTab("triggers")} />
        <TabButton label="การแจ้งเตือน" active={tab === "notifications"} onPress={() => setTab("notifications")} />
      </View>

      {tab === "triggers" ? <TriggersTab api={events} /> : <NotificationsTab api={logs} />}
    </Screen>
  );
}

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TriggersTab({ api }: { api: ReturnType<typeof useApi<AlertEventPage>> }) {
  if (api.loading && api.data === null) return <Spinner />;
  return (
    <>
      <ErrorBanner message={api.error} />
      {(api.data?.events ?? []).length === 0 && !api.error ? (
        <EmptyState title="ยังไม่มีเหตุการณ์" description="เมื่อราคาถึงเงื่อนไข Alert จะปรากฏที่นี่" />
      ) : (
        <Card>
          {(api.data?.events ?? []).map((e, i) => (
            <View key={e.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Text style={styles.symbol}>{e.symbol}</Text>
                  <Badge text={e.status === "TRIGGERED" ? "สำเร็จ" : "ล้มเหลว"} tone={e.status === "TRIGGERED" ? "green" : "red"} />
                </View>
                <Text style={styles.muted}>
                  ราคาขณะนั้น {fmtPrice(e.currentPrice)} · เป้า {fmtPrice(e.targetPrice)}
                </Text>
                {e.alertRule?.name ? <Text style={styles.muted}>Alert: {e.alertRule.name}</Text> : null}
              </View>
              <Text style={styles.time}>{fmtDateTime(e.triggeredAt)}</Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

function NotificationsTab({ api }: { api: ReturnType<typeof useApi<NotificationLogPage>> }) {
  if (api.loading && api.data === null) return <Spinner />;
  return (
    <>
      <ErrorBanner message={api.error} />
      {(api.data?.logs ?? []).length === 0 && !api.error ? (
        <EmptyState title="ยังไม่มีการแจ้งเตือน" description="ประวัติการส่ง Push/แจ้งเตือนจะแสดงที่นี่" />
      ) : (
        <Card>
          {(api.data?.logs ?? []).map((l, i) => (
            <View key={l.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Text style={styles.name} numberOfLines={1}>
                    {l.title}
                  </Text>
                  <Badge text={l.status === "SENT" ? "ส่งแล้ว" : "ล้มเหลว"} tone={l.status === "SENT" ? "green" : "red"} />
                </View>
                <Text style={styles.muted} numberOfLines={2}>
                  {l.body}
                </Text>
                {l.errorMessage ? <Text style={styles.errorText}>{l.errorMessage}</Text> : null}
              </View>
              <Text style={styles.time}>{fmtDateTime(l.sentAt)}</Text>
            </View>
          ))}
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  tabText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  tabTextActive: { color: colors.primary },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  symbol: { color: colors.text, fontWeight: "800" },
  name: { color: colors.text, fontWeight: "700", flexShrink: 1 },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  time: { color: colors.textFaint, fontSize: 11 },
  errorText: { color: colors.danger, fontSize: 11, marginTop: 2 },
});
