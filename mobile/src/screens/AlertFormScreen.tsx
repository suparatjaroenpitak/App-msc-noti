import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Switch, Text, View } from "react-native";
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
import type { AlertRow, AssetSearchResult, SoundRow } from "../api/types";
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

export function AlertFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "AlertForm">>();
  const alertId = route.params?.id;

  const [loading, setLoading] = useState(Boolean(alertId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assetLabel, setAssetLabel] = useState("");
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
  const [soundId, setSoundId] = useState<string | null>(null);
  const [sounds, setSounds] = useState<SoundRow[]>([]);

  // Load existing alert (edit mode) + sound library.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const soundList = await api<{ sounds: SoundRow[] }>("/api/notification-sounds");
        if (!cancelled) setSounds(soundList.sounds);
      } catch {
        // sound library is optional
      }
      if (alertId) {
        try {
          const res = await api<{ alert: AlertRow }>(`/api/alerts/${alertId}`);
          if (cancelled) return;
          const alert = res.alert;
          setAssetLabel(`${alert.asset.symbol} — ${alert.asset.name}`);
          setName(alert.name);
          setType(alert.type);
          setCondition(alert.condition);
          setTargetPrice(String(alert.targetPrice));
          setCooldownMinutes(String(alert.cooldownMinutes));
          setOneTime(alert.oneTime);
          setNotificationMessage(alert.notificationMessage ?? "");
          setSoundId(alert.soundId ?? null);
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
      setAssetLabel(`${res.asset.symbol} — ${res.asset.name}`);
      if (!name) setName(`${res.asset.symbol} Alert`);
    } catch (err) {
      setError(errorMessage(err));
    }
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
    const price = Number(targetPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("ราคาเป้าหมายต้องเป็นตัวเลขมากกว่า 0");
      return;
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
        condition,
        targetPrice: price,
        cooldownMinutes: Math.round(cooldown),
        oneTime,
        notificationMessage: notificationMessage.trim() ? notificationMessage.trim() : null,
        soundId,
      };
      if (alertId) {
        await api(`/api/alerts/${alertId}`, { method: "PATCH", body: payload });
      } else {
        await api("/api/alerts", { method: "POST", body: { ...payload, assetId, enabled: true } });
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
      <SectionTitle subtitle={alertId ? "แก้ไขเงื่อนไขการแจ้งเตือน" : "ตั้งเงื่อนไขราคาที่ต้องการแจ้งเตือน"}>
        {alertId ? "แก้ไข Alert" : "สร้าง Alert ใหม่"}
      </SectionTitle>

      <ErrorBanner message={error} />

      <Card>
        <Text style={styles.label}>หุ้น / ETF</Text>
        {assetLabel ? (
          <View style={styles.assetChosen}>
            <Text style={styles.assetText}>{assetLabel}</Text>
            {!alertId ? (
              <Pressable onPress={() => { setAssetId(null); setAssetLabel(""); }}>
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

        <Text style={styles.label}>Cooldown (นาที)</Text>
        <Input value={cooldownMinutes} onChangeText={setCooldownMinutes} keyboardType="number-pad" />

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>One-time (ปิด Alert หลังแจ้งเตือนครั้งแรก)</Text>
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

        <Text style={styles.label}>เสียงแจ้งเตือน (เล่นเมื่อเปิดแอป/เว็บอยู่)</Text>
        <View style={styles.optionRow}>
          <Pressable
            onPress={() => setSoundId(null)}
            style={[styles.option, soundId === null && styles.optionActive]}
          >
            <Text style={[styles.optionText, soundId === null && styles.optionTextActive]}>ค่าเริ่มต้น</Text>
          </Pressable>
          {sounds.map((sound) => (
            <Pressable
              key={sound.id}
              onPress={() => setSoundId(sound.id)}
              style={[styles.option, soundId === sound.id && styles.optionActive]}
            >
              <Text
                style={[styles.optionText, soundId === sound.id && styles.optionTextActive]}
                numberOfLines={1}
              >
                {sound.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Button
        title={alertId ? "บันทึกการแก้ไข" : "สร้าง Alert"}
        onPress={() => void submit()}
        loading={saving}
      />
      <Button title="ยกเลิก" variant="secondary" onPress={() => navigation.goBack()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: spacing.sm },
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  switchLabel: { color: colors.text, fontSize: 13, flex: 1 },
});
