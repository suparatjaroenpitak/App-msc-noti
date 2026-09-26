import React, { useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { api } from "../api/client";
import { useApi, errorMessage } from "../hooks/useApi";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Screen, SectionTitle, Spinner } from "../components/ui";
import type { AnalysisRow, AnalysisSettings, SuggestPriceResult } from "../api/types";
import { colors, spacing } from "../theme";

function fmtPrice(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "-";
}

const VERDICT_TONE: Record<string, "green" | "amber" | "red"> = {
  BUY: "green",
  WAIT: "amber",
  AVOID: "red",
};
const VERDICT_LABEL: Record<string, string> = { BUY: "น่าซื้อ", WAIT: "รอก่อน", AVOID: "เลี่ยง" };

export function AnalysisScreen() {
  const settings = useApi<{ settings: AnalysisSettings }>("/api/analysis/settings");
  const history = useApi<{ analyses: AnalysisRow[]; total: number }>("/api/analysis/history?pageSize=20");
  const [symbol, setSymbol] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSetting = async (key: keyof AnalysisSettings, value: boolean | number) => {
    try {
      await api("/api/analysis/settings", { method: "PATCH", body: { [key]: value } });
      settings.reload();
    } catch (err) {
      Alert.alert("บันทึกไม่สำเร็จ", errorMessage(err));
    }
  };

  const runAnalysis = async () => {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api<SuggestPriceResult>("/api/analysis/suggest-price", {
        method: "POST",
        body: { symbol: sym },
      });
      Alert.alert(
        `ผลวิเคราะห์ ${sym}`,
        [
          res.analysis.verdict ? `คำแนะนำ: ${VERDICT_LABEL[res.analysis.verdict] ?? res.analysis.verdict}` : null,
          res.analysis.suggestedEntryPrice ? `ราคาเข้า: ${fmtPrice(res.analysis.suggestedEntryPrice)}` : null,
          res.analysis.suggestedStopPrice ? `ตัดขาดทุน: ${fmtPrice(res.analysis.suggestedStopPrice)}` : null,
          res.analysis.suggestedTargetPrice ? `เป้าหมาย: ${fmtPrice(res.analysis.suggestedTargetPrice)}` : null,
          res.analysis.rationale,
        ]
          .filter(Boolean)
          .join("\n"),
      );
      history.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (settings.loading && settings.data === null) return <Screen><Spinner label="กำลังโหลดการตั้งค่า…" /></Screen>;

  const s = settings.data?.settings;

  return (
    <Screen refreshing={history.loading} onRefresh={history.reload}>
      <SectionTitle subtitle="เครื่องมือวิเคราะห์ราคาจากข้อมูลย้อนหลัง (ไม่ใช่คำแนะนำการลงทุน)">วิเคราะห์ราคา</SectionTitle>

      <Card>
        <Text style={styles.label}>สัญลักษณ์หุ้น เช่น AAPL</Text>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input value={symbol} onChangeText={(t) => setSymbol(t.toUpperCase())} placeholder="AAPL" autoCapitalize="characters" />
          </View>
          <Button title="วิเคราะห์" onPress={runAnalysis} loading={busy} disabled={busy || !symbol.trim()} />
        </View>
        <ErrorBanner message={error} />
      </Card>

      {s ? (
        <>
          <SectionTitle subtitle="ตั้งค่าเดียวกับเว็บ (Settings → Analysis)">การตั้งค่า</SectionTitle>
          <Card>
            <SettingSwitch
              label="เปิดใช้การวิเคราะห์"
              value={s.enabled}
              onChange={(v) => void toggleSetting("enabled", v)}
            />
            <SettingSwitch
              label="แนะนำราคาเข้าตอนสร้าง Alert"
              value={s.suggestOnCreate}
              onChange={(v) => void toggleSetting("suggestOnCreate", v)}
            />
            <SettingSwitch
              label="วิเคราะห์อัตโนมัติเมื่อ Alert ทำงาน"
              value={s.analyzeOnTrigger}
              onChange={(v) => void toggleSetting("analyzeOnTrigger", v)}
              last
            />
          </Card>
        </>
      ) : null}

      <SectionTitle subtitle={`${history.data?.total ?? 0} รายการล่าสุด`}>ประวัติการวิเคราะห์</SectionTitle>
      <ErrorBanner message={history.error} />
      {(history.data?.analyses ?? []).length === 0 && !history.error ? (
        <EmptyState title="ยังไม่มีผลวิเคราะห์" description="รันการวิเคราะห์ด้านบน หรือเปิดใช้วิเคราะห์อัตโนมัติ" />
      ) : (
        <Card>
          {(history.data?.analyses ?? []).map((a, i) => (
            <View key={a.id} style={[styles.row, i > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Text style={styles.symbol}>{a.symbol}</Text>
                  {a.verdict ? (
                    <Badge text={VERDICT_LABEL[a.verdict] ?? a.verdict} tone={VERDICT_TONE[a.verdict] ?? "amber"} />
                  ) : null}
                  <Badge text={a.kind === "SUGGEST_PRICE" ? "แนะนำราคา" : "ทริกเกอร์"} tone="gray" />
                </View>
                <Text style={styles.muted}>
                  ราคา {fmtPrice(a.priceAtAnalysis)}
                  {a.suggestedEntryPrice ? ` · เข้า ${fmtPrice(a.suggestedEntryPrice)}` : ""}
                  {a.suggestedStopPrice ? ` · ตัด ${fmtPrice(a.suggestedStopPrice)}` : ""}
                  {a.suggestedTargetPrice ? ` · เป้า ${fmtPrice(a.suggestedTargetPrice)}` : ""}
                </Text>
                {a.rationale ? (
                  <Text style={styles.rationale} numberOfLines={2}>
                    {a.rationale}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.time}>{new Date(a.createdAt).toLocaleDateString("th-TH")}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}

function SettingSwitch({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <View style={[styles.switchRow, !last && styles.rowBorder]}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs },
  searchRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  switchLabel: { color: colors.text, flex: 1, paddingRight: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  symbol: { color: colors.text, fontWeight: "800" },
  muted: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  rationale: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  time: { color: colors.textFaint, fontSize: 11 },
});
