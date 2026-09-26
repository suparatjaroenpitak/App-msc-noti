import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth";
import { useEffect, useRef } from "react";
import { useApi } from "../hooks/useApi";
import { playForAlert } from "../lib/local-sounds";
import { Badge, Card, EmptyState, ErrorBanner, Muted, Screen, SectionTitle, Spinner } from "../components/ui";
import type { AlertEventRow, AlertRow, SystemStatus, WatchItem } from "../api/types";
import { colors, radius, spacing } from "../theme";

function formatPrice(value: number | string, currency = "USD"): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${currency === "USD" ? "$" : ""}${n.toFixed(2)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

export function DashboardScreen() {
  const status = useApi<SystemStatus>("/api/system/status");
  const watchlist = useApi<{ items: WatchItem[] }>("/api/watchlist");
  const alerts = useApi<{ alerts: AlertRow[] }>("/api/alerts");
  const events = useApi<{ events: AlertEventRow[] }>("/api/alert-history?pageSize=5");

  const loading = status.loading || watchlist.loading || alerts.loading || events.loading;
  const error = status.error || watchlist.error || alerts.error || events.error;
  const activeAlerts = alerts.data?.alerts.filter((a) => a.enabled).length ?? 0;

  // Play the locally-selected sound whenever a NEW triggered event shows up (device-only).
  // AlertEventRow has no alertRule.id; look up the rule via the alerts list when possible.
  const seenEventRef = useRef<string | null>(null);
  const firstEventsLoadRef = useRef(true);
  useEffect(() => {
    const latest = events.data?.events?.[0];
    if (!latest) return;
    const prev = seenEventRef.current;
    seenEventRef.current = latest.id;
    if (firstEventsLoadRef.current) {
      firstEventsLoadRef.current = false;
      return; // don't blast sound on app open
    }
    if (prev !== null && prev !== latest.id && latest.status === "TRIGGERED") {
      void playForAlert();
    }
  }, [events.data]);

  const refresh = () => {
    status.reload();
    watchlist.reload();
    alerts.reload();
    events.reload();
  };

  return (
    <Screen refreshing={loading} onRefresh={refresh}>
      <View>
        <Text style={styles.greeting}>Stock Alert — ราคาจริง</Text>
        <Text style={styles.serverUrl}>ราคาล่าสุดจาก Yahoo Finance · อัพเดททุก 30 วินาที · ข้อมูลเก็บในเครื่อง</Text>
      </View>

      <ErrorBanner message={error} />

      <View style={styles.stats}>
        <Stat label="Watchlist" value={watchlist.data ? String(watchlist.data.items.length) : "…"} />
        <Stat label="Active Alerts" value={alerts.data ? String(activeAlerts) : "…"} />
        <Stat
          label="ตลาดสหรัฐฯ"
          value={status.data ? status.data.market.label : "…"}
          tone={status.data?.market.state === "OPEN" ? "green" : "gray"}
        />
      </View>

      <View>
        <SectionTitle subtitle="ราคาล่าสุดจาก Yahoo Finance">Watchlist</SectionTitle>
        <Card>
          {watchlist.data === null && watchlist.loading ? (
            <Spinner />
          ) : (watchlist.data?.items.length ?? 0) === 0 ? (
            <EmptyState title="ยังไม่มีหุ้นใน Watchlist" description="เพิ่มได้ที่แท็บ Watchlist" />
          ) : (
            watchlist.data!.items.slice(0, 5).map((item, index) => (
              <View key={item.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Text style={styles.muted} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>
                    {item.quote ? formatPrice(item.quote.price, item.quote.currency) : "—"}
                  </Text>
                  {item.quote ? (
                    <Text style={[styles.change, { color: item.quote.change >= 0 ? colors.success : colors.danger }]}>
                      {item.quote.change >= 0 ? "+" : ""}
                      {item.quote.change.toFixed(2)} ({item.quote.changePercent.toFixed(2)}%)
                    </Text>
                  ) : (
                    <Text style={styles.muted}>กำลังโหลดราคา…</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </Card>
      </View>

      <View>
        <SectionTitle subtitle="การแจ้งเตือนที่ trigger แล้ว">เหตุการณ์ล่าสุด</SectionTitle>
        <Card>
          {events.data === null && events.loading ? (
            <Spinner />
          ) : (events.data?.events.length ?? 0) === 0 ? (
            <EmptyState title="ยังไม่มีการแจ้งเตือน" description="เมื่อ Alert trigger เหตุการณ์จะแสดงที่นี่" />
          ) : (
            events.data!.events.map((event, index) => (
              <View key={event.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.symbol}>{event.symbol}</Text>
                  <Text style={styles.muted}>
                    ราคา {formatPrice(event.currentPrice)} · เป้า {formatPrice(event.targetPrice)} ·{" "}
                    {timeAgo(event.triggeredAt)}
                  </Text>
                </View>
                <Badge text={event.status} tone={event.status === "TRIGGERED" ? "green" : "red"} />
              </View>
            ))
          )}
        </Card>
      </View>

      <View>
        <SectionTitle>สถานะระบบ</SectionTitle>
        <Card>
          <SystemRow label="ฐานข้อมูล" ok={status.data?.db ?? null} />
          <SystemRow label="Push (VAPID) ฝั่งเว็บ" ok={status.data?.pushConfigured ?? null} />
          <SystemRow
            label={`แหล่งราคา (${status.data?.marketDataProvider ?? "…"})`}
            ok={status.data?.marketDataProviderHealthy ?? null}
          />
          <Muted>
            Push แบบ native (FCM) ยังไม่เปิดใช้ในเวอร์ชันนี้ — การแจ้งเตือนบนแอปจะดูได้จากประวัติด้านบน
          </Muted>
        </Card>
      </View>
    </Screen>
  );
}

function Stat({ label, value, tone = "gray" }: { label: string; value: string; tone?: "gray" | "green" }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, tone === "green" && { color: colors.success }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function SystemRow({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <View style={styles.systemRow}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={{ color: ok === null ? colors.textFaint : ok ? colors.success : colors.warning, fontWeight: "700" }}>
        {ok === null ? "…" : ok ? "✅ ปกติ" : "⚠️ มีปัญหา"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.text, fontSize: 22, fontWeight: "800" },
  serverUrl: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  symbol: { color: colors.text, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 12 },
  price: { color: colors.text, fontWeight: "700" },
  change: { fontSize: 11, fontWeight: "600" },
  systemRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
});
