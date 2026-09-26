import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { errorMessage } from "../hooks/useApi";
import { useConnection } from "../auth";
import { Button, Card, Input, Screen, SectionTitle } from "../components/ui";
import { colors, spacing } from "../theme";

/** Server connection screen — auth removed; rename/password features are gone. */
export function ProfileServerInfo() {
  const { serverUrl, setServerUrl, user, setUser } = useConnection();
  const [urlDraft, setUrlDraft] = useState(serverUrl);
  const [saving, setSaving] = useState(false);

  const loadUser = async () => {
    try {
      const res = await api<{ user: { id: string; name: string; email: string } }>("/api/auth-user");
      setUser({ id: res.user.id, name: res.user.name, email: res.user.email });
    } catch (err) {
      Alert.alert("ดึงข้อมูลไม่สำเร็จ", errorMessage(err));
    }
  };

  const saveUrl = async () => {
    setSaving(true);
    try {
      await setServerUrl(urlDraft);
      Alert.alert("บันทึกแล้ว", "เปลี่ยนเซิร์ฟเวอร์เรียบร้อย");
    } catch (err) {
      Alert.alert("บันทึกไม่สำเร็จ", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <SectionTitle subtitle="ระบบนี้ไม่มีการยืนยันตัวตน — ข้อมูลผูกกับเซิร์ฟเวอร์ที่เชื่อมต่อ">เซิร์ฟเวอร์</SectionTitle>
      <Card>
        <Text style={styles.label}>API URL</Text>
        <Input value={urlDraft} onChangeText={setUrlDraft} keyboardType="url" placeholder="https://your-app.onrender.com" />
        <Button
          title="บันทึกเซิร์ฟเวอร์"
          size="sm"
          variant="secondary"
          loading={saving}
          disabled={urlDraft.trim() === serverUrl}
          onPress={() => void saveUrl()}
        />
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
        <Button title="รีเฟรชข้อมูล" size="sm" variant="secondary" onPress={() => void loadUser()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: spacing.xs },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  key: { color: colors.textMuted, fontSize: 13 },
  val: { color: colors.text, fontSize: 13, fontWeight: "600" },
});
