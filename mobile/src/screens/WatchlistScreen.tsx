import React, { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useApi, errorMessage } from "../hooks/useApi";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Screen, SectionTitle, Spinner } from "../components/ui";
import type { AssetSearchResult, WatchItem } from "../api/types";
import { colors, radius, spacing } from "../theme";

export function WatchlistScreen() {
  const { data, error, loading, reload } = useApi<{ items: WatchItem[] }>("/api/watchlist");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  // Debounced symbol search.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api<{ results: AssetSearchResult[] }>(
          `/api/assets/search?q=${encodeURIComponent(trimmed)}`,
        );
        if (!cancelled) {
          setResults(res.results);
          setSearchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setSearchError(errorMessage(err));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const items = data?.items ?? [];
  const inList = new Set(items.map((i) => i.symbol));

  const add = async (symbol: string) => {
    setAdding(symbol);
    try {
      await api("/api/watchlist", { method: "POST", body: { symbol } });
      setQuery("");
      setResults([]);
      reload();
    } catch (err) {
      Alert.alert("เพิ่มไม่สำเร็จ", errorMessage(err));
    } finally {
      setAdding(null);
    }
  };

  const remove = (item: WatchItem) => {
    Alert.alert(`ลบ ${item.symbol}?`, "Alert ที่ผูกกับหุ้นนี้จะไม่ถูกลบ", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/watchlist/${item.id}`, { method: "DELETE" });
            reload();
          } catch (err) {
            Alert.alert("ลบไม่สำเร็จ", errorMessage(err));
          }
        },
      },
    ]);
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const current = next[index];
    const other = next[target];
    if (!current || !other) return;
    next[index] = other;
    next[target] = current;
    try {
      await api("/api/watchlist/reorder", { method: "PATCH", body: { items: next.map((i) => i.id) } });
      reload();
    } catch (err) {
      Alert.alert("จัดเรียงไม่สำเร็จ", errorMessage(err));
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <SectionTitle subtitle="ค้นหาด้วย ticker เช่น AAPL, NVDA, VTI">เพิ่มหุ้น / ETF</SectionTitle>
      <Input value={query} onChangeText={setQuery} placeholder="ค้นหา symbol เช่น AAPL" autoCapitalize="characters" />
      {searching ? <Spinner label="กำลังค้นหา…" /> : null}
      <ErrorBanner message={searchError} />
      {results.length > 0 ? (
        <Card>
          {results.map((result, index) => (
            <View key={result.symbol} style={[styles.row, index > 0 && styles.rowBorder]}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowInline}>
                  <Text style={styles.symbol}>{result.symbol}</Text>
                  <Badge text={result.type} tone={result.type === "ETF" ? "blue" : "gray"} />
                </View>
                <Text style={styles.muted} numberOfLines={1}>
                  {result.name} · {result.exchange}
                </Text>
              </View>
              <Button
                title={inList.has(result.symbol) ? "มีแล้ว" : "เพิ่ม"}
                size="sm"
                variant={inList.has(result.symbol) ? "secondary" : "primary"}
                disabled={inList.has(result.symbol) || adding === result.symbol}
                loading={adding === result.symbol}
                onPress={() => void add(result.symbol)}
              />
            </View>
          ))}
        </Card>
      ) : null}

      <SectionTitle>{`รายการที่ติดตาม (${items.length})`}</SectionTitle>
      <ErrorBanner message={error} />
      <Card>
        {loading && data === null ? (
          <Spinner />
        ) : items.length === 0 ? (
          <EmptyState title="Watchlist ว่างเปล่า" description="ค้นหาด้านบนเพื่อเพิ่มหุ้นที่สนใจ" />
        ) : (
          items.map((item, index) => (
            <View key={item.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <View style={styles.orderButtons}>
                <Pressable onPress={() => void move(index, -1)} disabled={index === 0}>
                  <Text style={[styles.orderArrow, index === 0 && styles.orderArrowDisabled]}>▲</Text>
                </Pressable>
                <Pressable onPress={() => void move(index, 1)} disabled={index === items.length - 1}>
                  <Text style={[styles.orderArrow, index === items.length - 1 && styles.orderArrowDisabled]}>▼</Text>
                </Pressable>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.rowInline}>
                  <Text style={styles.symbol}>{item.symbol}</Text>
                  <Badge text={item.type} tone={item.type === "ETF" ? "blue" : "gray"} />
                  {item.alertCount > 0 ? <Badge text={`${item.alertCount} alert`} tone="green" /> : null}
                </View>
                <Text style={styles.muted} numberOfLines={1}>
                  {item.quote
                    ? `$${item.quote.price.toFixed(2)} · ${item.quote.change >= 0 ? "+" : ""}${item.quote.changePercent.toFixed(2)}%`
                    : item.name}
                </Text>
              </View>
              <Pressable onPress={() => remove(item)} hitSlop={8}>
                <Text style={styles.delete}>ลบ</Text>
              </Pressable>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  rowInline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  symbol: { color: colors.text, fontWeight: "700" },
  muted: { color: colors.textMuted, fontSize: 12 },
  delete: { color: colors.danger, fontWeight: "700", paddingHorizontal: spacing.sm },
  orderButtons: { alignItems: "center", paddingRight: spacing.xs },
  orderArrow: { color: colors.textMuted, fontSize: 14, paddingVertical: 2, paddingHorizontal: 4 },
  orderArrowDisabled: { color: colors.border },
});
