import React, { useEffect, useState } from "react";
import { Alert as RnAlert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { api } from "../api/client";
import { errorMessage } from "../hooks/useApi";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  Input,
  Screen,
  SectionTitle,
  Spinner,
} from "../components/ui";
import type { AlertMode, AlertRow, AssetSearchResult } from "../api/types";
import { getAlertSoundId, listSounds, saveAlertSoundId, type LocalSound } from "../lib/local-sounds";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing } from "../theme";

type AlertType = "ENTRY" | "EXIT" | "CUSTOM";
type AlertCondition = "ABOVE_OR_EQUAL" | "BELOW_OR_EQUAL";

const TYPES: { value: AlertType; label: string }[] = [
  { value: "ENTRY", label: "Entry" },
  { value: "EXIT", label: "Exit" },
  { value: "CUSTOM", label: "Custom" },
];

const CONDITIONS: { value: AlertCondition; label: string }[] = [
  { value: "ABOVE_OR_EQUAL", label: "ราคา ≥ เป้าหมาย" },
  { value: "BELOW_OR_EQUAL", label: "ราคา ≤ เป้าหมาย" },
];

const MODES: { value: AlertMode; label: string; desc: string }[] = [
  { value: "AUTO", label: "🤖 อัตโนมัติ", desc: "ไม่ต้องตั้งราคา — ระบบวิเคราะห์แล้วแจ้ง \"จังหวะราคาเข้า\" ให้เอง พร้อมสร้าง Alert ราคาเข้าให้อัตโนมัติ" },
  { value: "MANUAL", label: "🎯 ตั้งราคาเอง", desc: "เลือกราคาเป้าหมายเอง แล้วแจ้งเตือนทันทีที่ราคาถึงจุดที่ตั้งไว้" },
];

type SuggestEntryResult = {
  suggestion: {
    verdict: string | null;
    suggestedEntryPrice: number | null;
    suggestedStopPrice: number | null;
    suggestedTargetPrice: number | null;
    confidence: number | null;
    rationale: string | null;
  };
};

const VERDICT_LABEL: Record<string, string> = {
  BUY: "น่าซื้อ",
  WAIT: "รอก่อน",
  AVOID: "เลี่ยง",
};

function fmt(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "-";
}

export function AlertFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AlertForm">>();
  const alertId = route.params?.id;

  const [loading, setLoading] = useState(Boolean(alertId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<AlertMode>("MANUAL");
  const [assetLabel, setAssetLabel] = useState("");
  const [assetSymbol, setAssetSymbol] = useState<string | null>(null);
  const [assetId, setAssetId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<AlertType>("ENTRY");
  const [condition, setCondition] = useState<AlertCondition>("BELOW_OR_EQUAL");
  const [targetPrice, setTargetPrice] = useState("");
  const [cooldownMinutes, setCooldownMinutes] = useState("60");
  const [oneTime, setOneTime] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [alertSoundId, setAlertSoundId] = useState<string | null | undefined>(undefined);
  const [sounds, setSounds] = useState<LocalSound[]>([]);

  // AUTO preview — ผลวิเคราะห์ล่าสุดของหุ้นที่เลือก (แสดงราคาเข้าที่ระบบจะแจ้งเตือน)
  const [suggest, setSuggest] = useState<SuggestEntryResult["suggestion"] | null>(null);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const loadSuggestion = async (symbol: string) => {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const res = await api<SuggestEntryResult>("/api/analysis/suggest-price", {
        method: "POST",
        body: { symbol },
      });
      setSuggest(res.suggestion);
    } catch (err) {
      setSuggest(null);
      setSuggestError(errorMessage(err));
    } finally {
      setSuggestLoading(false);
    }
  };

  // Load existing alert (edit mode) + local sound library (no API for sounds).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const soundList = await listSounds();
        if (!cancelled) setSounds(soundList);
      } catch {
        // sound library is optional
      }
      if (alertId) {
        try {
          const res = await api<{ alert: AlertRow }>(`/api/alerts/${alertId}`);
          if (cancelled) return;
          const alert = res.alert;
          setAssetLabel(`${alert.asset.symbol} — ${alert.asset.name}`);
          setAssetSymbol(alert.asset.symbol);
          setName(alert.name);
          setType(alert.type);
          if (alert.mode === "AUTO") setMode("AUTO");
          setCondition(alert.condition);
          if (alert.mode !== "AUTO") setTargetPrice(String(alert.targetPrice));
          setCooldownMinutes(String(alert.cooldownMinutes));
          setOneTime(alert.oneTime);
          setNotificationMessage(alert.notificationMessage ?? "");
          // Local per-alert sound override (kept on this device only).
          setAlertSoundId(await getAlertSoundId(alertId));
        } catch (err) {
          if (!cancelled) setError(errorMessage(err));
        } finally {
          if (!cancelled) setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alertId]);

  // Debounced asset search (create mode only).
  useEffect(() => {
    if (alertId) return;
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ results: AssetSearchResult[] }>(
          `/api/assets/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!cancelled) setSearchResults(res.results);
      } catch {
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, alertId]);

  const chooseAsset = async (result: AssetSearchResult) => {
    setQuery("");
    setSearchResults([]);
    setError(null);
    try {
      const res = await api<{ asset: { id: string; symbol: string; name: string } }>(
        `/api/assets/${result.symbol}`,
      );
      setAssetId(res.asset.id);
      setAssetSymbol(res.asset.symbol);
      setAssetLabel(`${res.asset.symbol} — ${res.asset.name}`);
      if (!name) setName(`${res.asset.symbol} Alert`);
      if (mode === "AUTO") void loadSuggestion(res.asset.symbol);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const pickMode = (next: AlertMode) => {
    setMode(next);
    setSuggest(null);
    setSuggestError(null);
    if (next === "AUTO" && assetSymbol) void loadSuggestion(assetSymbol);
  };

  const submit = async () => {
    setError(null);
    if (!alertId && !assetId) {
      setError("เลือกหุ้น/ETF ก่อน");
      return;
    }
    if (!name.trim()) {
      setError("ตั้งชื่อ Alert ก่อน");
      return;
    }
    let price = 0;
    if (mode === "MANUAL") {
      price = Number(targetPrice);
      if (!Number.isFinite(price) || price <= 0) {
        setError("ราคาเป้าหมายต้องเป็นตัวเลขมากกว่า 0");
        return;
      }
    }
    const cooldown = Number(cooldownMinutes);
    if (!Number.isFinite(cooldown) || cooldown < 0) {
      setError("Cooldown ต้องเป็นตัวเลข 0 ขึ้นไป");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        type,
        mode,
        condition,
        cooldownMinutes: Math.round(cooldown),
        oneTime,
        notificationMessage: notificationMessage.trim() ? notificationMessage.trim() : null,
      };
      if (mode === "MANUAL") payload.targetPrice = price;

      if (alertId) {
        await api(`/api/alerts/${alertId}`, { method: "PATCH", body: payload });
        // Remember the chosen sound locally for this alert (not sent to the server).
        await saveAlertSoundId(alertId, alertSoundId ?? null);
      } else {
        const created = await api<{ alert: AlertRow }>("/api/alerts", {
          method: "POST",
          body: { ...payload, assetId, enabled: true },
        });
        await saveAlertSoundId(created.alert.id, alertSoundId ?? null);
      }
      navigation.goBack();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Spinner label="กำลังโหลด Alert…" />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionTitle subtitle={alertId ? "แก้ไขเงื่อนไขการแจ้งเตือน" : "เลือกโหมดการแจ้งเตือนที่ต้องการ"}>
        {alertId ? "แก้ไข Alert" : "สร้าง Alert ใหม่"}
      </SectionTitle>

      <ErrorBanner message={error} />

      <Card>
        <Text style={styles.label}>โหมดการแจ้งเตือน</Text>
        <View style={styles.modeRow}>
          {MODES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => pickMode(option.value)}
              style={[styles.modeCard, mode === option.value && styles.modeCardActive]}
            >
              <Text style={[styles.modeTitle, mode === option.value && styles.modeTitleActive]}>
                {option.label}
              </Text>
              <Text style={styles.modeDesc}>{option.desc}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>หุ้น / ETF</Text>
        {assetLabel ? (
          <View style={styles.assetChosen}>
            <Text style={styles.assetText}>{assetLabel}</Text>
            {!alertId ? (
              <Pressable onPress={() => { setAssetId(null); setAssetSymbol(null); setAssetLabel(""); setSuggest(null); }}>
                <Text style={styles.change}>เปลี่ยน</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <>
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="ค้นหา symbol เช่น QQQM"
              autoCapitalize="characters"
            />
            {searching ? <Spinner label="กำลังค้นหา…" /> : null}
            {searchResults.map((result) => (
              <Pressable key={result.symbol} style={styles.searchRow} onPress={() => void chooseAsset(result)}>
                <View style={styles.searchInline}>
                  <Text style={styles.assetText}>{result.symbol}</Text>
                  <Badge text={result.type} tone={result.type === "ETF" ? "blue" : "gray"} />
                </View>
                <Text style={styles.muted} numberOfLines={1}>
                  {result.name} · {result.exchange}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {mode === "AUTO" ? (
          <>
            <View style={styles.autoNote}>
              <Text style={styles.autoNoteText}>
                🤖 ระบบจะวิเคราะห์ราคาให้เอง (SMA · RSI · โมเมนตัม · ความผันผวน) แล้วแจ้งเตือน
                “จังหวะราคาเข้า” พร้อมสร้าง Alert ราคาเข้าให้อัตโนมัติ — ไม่ต้องกรอกราคา
              </Text>
            </View>

            {suggestLoading ? <Spinner label="กำลังวิเคราะห์…" /> : null}
            {suggestError ? <Text style={styles.suggestError}>{suggestError}</Text> : null}
            {suggest ? (
              <View style={styles.suggestCard}>
                <View style={styles.searchInline}>
                  <Text style={styles.suggestTitle}>ตัวอย่างผลวิเคราะห์ล่าสุด</Text>
                  {suggest.verdict ? (
                    <Badge
                      text={VERDICT_LABEL[suggest.verdict] ?? suggest.verdict}
                      tone={suggest.verdict === "BUY" ? "green" : suggest.verdict === "AVOID" ? "red" : "amber"}
                    />
                  ) : null}
                </View>
                <Text style={styles.suggestLine}>
                  ราคาเข้าที่ระบบจะแจ้ง: <Text style={styles.suggestStrong}>${fmt(suggest.suggestedEntryPrice)}</Text>
                  {suggest.suggestedStopPrice != null ? ` · ตัดขาดทุน $${fmt(suggest.suggestedStopPrice)}` : ""}
                  {suggest.suggestedTargetPrice != null ? ` · เป้าหมาย $${fmt(suggest.suggestedTargetPrice)}` : ""}
                </Text>
                {suggest.confidence != null ? (
                  <Text style={styles.suggestMuted}>ความมั่นใจ {Math.round(suggest.confidence * 100)}%</Text>
                ) : null}
                {suggest.rationale ? (
                  <Text style={styles.suggestMuted} numberOfLines={3}>
                    {suggest.rationale}
                  </Text>
                ) : null}
                <Text style={styles.suggestMuted}>
                  * แจ้งเตือนเมื่อสัญญาณชัด (ผลวิเคราะห์เปลี่ยนไปตามตลาดแบบเรียลไทม์) · ไม่ใช่คำแนะนำการลงทุน
                </Text>
              </View>
            ) : null}
          </>
        ) : null}

        <Text style={styles.label}>ชื่อ Alert</Text>
        <Input value={name} onChangeText={setName} placeholder="เช่น QQQM ซื้อกระทบยอด" />

        <Text style={styles.label}>ประเภท</Text>
        <View style={styles.optionRow}>
          {TYPES.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => setType(option.value)}
              style={[styles.option, type === option.value && styles.optionActive]}
            >
              <Text style={[styles.optionText, type === option.value && styles.optionTextActive]}>{option.label}</Text>
            </Pressable>
          ))}
        </View>

        {mode === "MANUAL" ? (
          <>
            <Text style={styles.label}>เงื่อนไข</Text>
            <View style={styles.optionRow}>
              {CONDITIONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setCondition(option.value)}
                  style={[styles.option, condition === option.value && styles.optionActive]}
                >
                  <Text style={[styles.optionText, condition === option.value && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>ราคาเป้าหมาย (USD)</Text>
            <Input
              value={targetPrice}
              onChangeText={setTargetPrice}
              placeholder="180.00"
              keyboardType="decimal-pad"
            />
          </>
        ) : null}

        <Text style={styles.label}>Cooldown (นาที)</Text>
        <Input value={cooldownMinutes} onChangeText={setCooldownMinutes} keyboardType="number-pad" />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>
            {mode === "AUTO"
              ? "One-time (หยุดเฝ้าดูหลังแจ้งจังหวะเข้าครั้งแรก)"
              : "One-time (ปิด Alert หลังแจ้งเตือนครั้งแรก)"}
          </Text>
          <Switch
            value={oneTime}
            onValueChange={setOneTime}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor="#fff"
          />
        </View>

        <Text style={styles.label}>ข้อความแจ้งเตือน (ไม่บังคับ)</Text>
        <Input
          value={notificationMessage}
          onChangeText={setNotificationMessage}
          placeholder="เว้นว่าง = ใช้ข้อความมาตรฐาน"
          multiline
        />

        <Text style={styles.label}>เสียงแจ้งเตือน (เก็บในเครื่องนี้ — เล่นเมื่อแอปเปิดอยู่)</Text>
        <View style={styles.optionRow}>
          <Pressable
            onPress={() => setAlertSoundId(null)}
            style={[styles.option, (alertSoundId ?? null) === null && styles.optionActive]}
          >
            <Text style={[styles.optionText, (alertSoundId ?? null) === null && styles.optionTextActive]}>
              ค่าเริ่มต้นของเครื่อง
            </Text>
          </Pressable>
          {sounds.map((sound) => (
            <Pressable
              key={sound.id}
              onPress={() => setAlertSoundId(sound.id)}
              style={[styles.option, alertSoundId === sound.id && styles.optionActive]}
            >
              <Text
                style={[styles.optionText, alertSoundId === sound.id && styles.optionTextActive]}
                numberOfLines={1}
              >
                {sound.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Button
        title={alertId ? "บันทึกการแก้ไข" : mode === "AUTO" ? "สร้าง Alert (โหมดอัตโนมัติ)" : "สร้าง Alert"}
        onPress={() => void submit()}
        loading={saving}
      />
      <Button title="ยกเลิก" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
  modeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  modeCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    padding: spacing.md,
  },
  modeCardActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  modeTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  modeTitleActive: { color: colors.primary },
  modeDesc: { color: colors.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  assetChosen: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  assetText: { color: colors.text, fontWeight: "700", flex: 1 },
  change: { color: colors.primary, fontWeight: "700", fontSize: 12 },
  searchRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  searchInline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  muted: { color: colors.textMuted, fontSize: 12 },
  optionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  option: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    maxWidth: "100%",
  },
  optionActive: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  optionText: { color: colors.textMuted, fontSize: 13, fontWeight: "600" },
  optionTextActive: { color: colors.primary },
  autoNote: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  autoNoteText: { color: colors.text, fontSize: 12, lineHeight: 17 },
  suggestCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: 4,
  },
  suggestTitle: { color: colors.text, fontWeight: "700", fontSize: 13, flex: 1 },
  suggestLine: { color: colors.text, fontSize: 12, lineHeight: 17 },
  suggestStrong: { color: colors.primary, fontWeight: "800" },
  suggestMuted: { color: colors.textMuted, fontSize: 11, lineHeight: 15 },
  suggestError: { color: colors.danger, fontSize: 12, marginTop: spacing.xs },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  switchLabel: { color: colors.text, fontSize: 13, flex: 1 },
});
