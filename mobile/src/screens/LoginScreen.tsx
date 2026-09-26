import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth";
import { errorMessage } from "../hooks/useApi";
import { Button, Card, ErrorBanner, Input } from "../components/ui";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/types";
import { colors, radius, spacing } from "../theme";

export function LoginScreen() {
  const { login, serverUrl } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [url, setUrl] = useState(serverUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!url.trim()) {
      setError("กรอก URL ของเซิร์ฟเวอร์ก่อน (เช่น https://your-app.onrender.com)");
      return;
    }
    if (!email.trim() || !password) {
      setError("กรอกอีเมลและรหัสผ่านให้ครบ");
      return;
    }
    setBusy(true);
    try {
      await login(email.trim(), password, url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>S</Text>
            </View>
            <Text style={styles.title}>Stock Alert</Text>
            <Text style={styles.subtitle}>ติดตามราคาหุ้น/ETF และจัดการ Alert จากมือถือ</Text>
          </View>

          <Card>
            <Text style={styles.label}>เซิร์ฟเวอร์ (API URL)</Text>
            <Input
              value={url}
              onChangeText={setUrl}
              placeholder="https://your-app.onrender.com"
              keyboardType="url"
            />
            <Text style={styles.label}>อีเมล</Text>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
            <Text style={styles.label}>รหัสผ่าน</Text>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              textContentType="password"
            />
            <ErrorBanner message={error} />
            <Button title="เข้าสู่ระบบ" onPress={() => void submit()} loading={busy} style={{ marginTop: spacing.sm }} />
            <Pressable onPress={() => navigation.navigate("Register")} style={styles.registerLink}>
              <Text style={styles.registerText}>ยังไม่มีบัญชี? สมัครสมาชิก</Text>
            </Pressable>
          </Card>

          <Text style={styles.hint}>
            ใช้บัญชีเดียวกับเว็บ PWA · ต้องเปิดผ่าน HTTPS (Render) สำหรับการใช้งานจริง
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  header: { alignItems: "center", marginTop: spacing.xxl, gap: spacing.xs },
  logo: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 26, fontWeight: "800" },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: colors.textMuted, fontSize: 13, textAlign: "center", paddingHorizontal: spacing.lg },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: "center" },
  registerLink: { alignItems: "center", paddingVertical: spacing.sm },
  registerText: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
