import React from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type ViewStyle,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radius, spacing } from "../theme";

export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  if (!scroll) {
    return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
  }
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        size === "sm" && styles.buttonSm,
        variant === "primary" && { backgroundColor: colors.primary },
        variant === "secondary" && { backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border },
        variant === "danger" && { backgroundColor: colors.danger },
        variant === "ghost" && { backgroundColor: "transparent" },
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { opacity: 0.75 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={variant === "secondary" ? colors.text : "#fff"} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            size === "sm" && { fontSize: 13 },
            variant === "secondary" && { color: colors.text },
            variant === "ghost" && { color: colors.primary },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Input({ style, ...props }: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      style={[styles.input, style]}
      autoCapitalize="none"
      autoCorrect={false}
      {...props}
    />
  );
}

export function Row({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Badge({
  text,
  tone = "gray",
}: {
  text: string;
  tone?: "gray" | "green" | "red" | "amber" | "blue";
}) {
  const tones: Record<string, { bg: string; fg: string }> = {
    gray: { bg: colors.cardAlt, fg: colors.textMuted },
    green: { bg: colors.primarySoft, fg: colors.success },
    red: { bg: colors.dangerSoft, fg: colors.danger },
    amber: { bg: "#3a2a10", fg: colors.warning },
    blue: { bg: "#16233f", fg: colors.info },
  };
  const tone_ = tones[tone] ?? tones.gray;
  return (
    <View style={[styles.badge, { backgroundColor: tone_.bg }]}>
      <Text style={[styles.badgeText, { color: tone_.fg }]}>{text}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {description ? <Text style={styles.emptyText}>{description}</Text> : null}
    </View>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: spacing.xl, alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} />
      {label ? <Text style={styles.mutedText}>{label}</Text> : null}
    </View>
  );
}

export function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={styles.mutedText}>{children}</Text>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  sectionSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  button: {
    height: 46,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  buttonSm: { height: 36, paddingHorizontal: spacing.md },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  input: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: 15,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontSize: 11, fontWeight: "700" },
  empty: { paddingVertical: spacing.xl, alignItems: "center", gap: spacing.xs },
  emptyTitle: { color: colors.text, fontWeight: "700" },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: "center" },
  errorBanner: {
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorText: { color: "#fecaca", fontSize: 13 },
  mutedText: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
});
