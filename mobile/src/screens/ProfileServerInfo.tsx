import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, Screen, SectionTitle, Badge } from "../components/ui";
import { colors, spacing } from "../theme";
import { APP_VERSION } from "../config";

/** Read-only system info — the app runs fully on-device now. */
export function ProfileServerInfo() {
  return (
    <Screen>
      <SectionTitle subtitle="ทั้งหมดทำงานในเครื่องนี้ — ไม่พึ่งเซิร์ฟเวอร์ภายนอก">ระบบของฉัน</SectionTitle>
      <Card>
        <View style={styles.row}>
          <Text style={styles.key}>โหมด</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
            <Badge text="OFFLINE" tone="green" />
            <Text style={styles.val}>local backend</Text>
          </View>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>ฐานข้อมูล</Text>
          <Text style={styles.val}>SQLite ในแอป</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>ข้อมูลราคา</Text>
          <Text style={styles.val}>Yahoo Finance (ราคาจริง)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>เครื่องยนต์เตือน</Text>
          <Text style={styles.val}>ตรวจทุก 30 วินาที (แอปเปิดอยู่)</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.key}>เวอร์ชัน</Text>
          <Text style={styles.val}>{APP_VERSION}</Text>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: spacing.xs, gap: spacing.md },
  key: { color: colors.textMuted, fontSize: 13 },
  val: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1, textAlign: "right" },
});
