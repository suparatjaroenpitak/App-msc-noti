import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useConnection } from "../auth";
import { Button, Card, Screen, SectionTitle } from "../components/ui";
import { colors, spacing } from "../theme";

/** Read-only server info — the URL is fixed in src/config.ts (no switching UI). */
export function ProfileServerInfo() {
  const { serverUrl, user, refreshUser } = useConnection();

  return (
    <Screen>
      <SectionTitle subtitle="เซิร์ฟเวอร์ถูกกำหนดถาวรในแอป (แก้ได้เฉพาะโค้ด)">เซิร์ฟเวอร์</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Text style={styles.key}>API URL</Text>
          <Text style={styles.val} numberOfLines={1} adjustsFontSizeToFit>
            {serverUrl.replace(/^https?:\/\//, "")}
          </Text>
        </View>
      </Card>

      <SectionTitle subtitle="ผู้ใช้เดียวของอินสแตนซ์นี้ (อัตโนมัติ)">ข้อมูลผู้ใช้</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Text style={styles.key}>ชื่อ</Text>
          <Text style={styles.val}>{user?.name ?? "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>อีเมล</Text>
          <Text style={styles.val}>{user?.email ?? "—"}</Text>
        </View>
        <Button title="รีเฟรชข้อมูล" size="sm" variant="secondary" onPress={refreshUser} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs, gap: spacing.md },
  key: { color: colors.textMuted, fontSize: 13 },
  val: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
});
