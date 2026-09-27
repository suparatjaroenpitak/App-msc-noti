import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { errorMessage } from "../hooks/useApi";
import {
  deleteSound,
  getDefaultSoundId,
  importSound,
  listSounds,
  previewSound,
  renameSound,
  setDefaultSound,
  stopPreview,
  type LocalSound,
} from "../lib/local-sounds";
import { Badge, Button, Card, EmptyState, ErrorBanner, Input, Muted, Screen, SectionTitle } from "../components/ui";
import { colors, spacing } from "../theme";

export function SoundsScreen() {
  const [sounds, setSounds] = useState<LocalSound[] | null>(null);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Cross-platform rename dialog (Alert.prompt is iOS-only).
  const [renameTarget, setRenameTarget] = useState<LocalSound | null>(null);
  const [renameText, setRenameText] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const importRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [list, def] = await Promise.all([listSounds(), getDefaultSoundId()]);
      setSounds(list);
      setDefaultId(def);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => stopPreview();
  }, [reload]);

  const upload = async () => {
    if (importRef.current) return;
    importRef.current = true;
    setImporting(true);
    setError(null);
    try {
      const created = await importSound();
      if (created) await reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      importRef.current = false;
      setImporting(false);
    }
  };

  const startRename = (sound: LocalSound) => {
    if (sound.kind === "builtin") {
      Alert.alert("เสียงในตัว", "เปลี่ยนชื่อเสียงในตัวไม่ได้ — สร้าง/นำเข้าเสียงของคุณเองเพื่อตั้งชื่อได้");
      return;
    }
    setRenameText(sound.name);
    setRenameTarget(sound);
  };

  const commitRename = async () => {
    const target = renameTarget;
    if (!target || renameSaving) return;
    const trimmed = renameText.trim();
    if (!trimmed) return;
    setRenameSaving(true);
    try {
      await renameSound(target.id, trimmed);
      setRenameTarget(null);
      await reload();
    } catch (err) {
      Alert.alert("เปลี่ยนชื่อไม่สำเร็จ", errorMessage(err));
    } finally {
      setRenameSaving(false);
    }
  };

  const preview = async (sound: LocalSound) => {
    try {
      const next = await previewSound(sound, playingId, () => setPlayingId((cur) => (cur === sound.id ? null : cur)));
      setPlayingId(next);
    } catch (err) {
      setPlayingId(null);
      Alert.alert("เล่นเสียงไม่ได้", errorMessage(err));
    }
  };

  const activate = async (sound: LocalSound) => {
    try {
      await setDefaultSound(sound.id);
      await reload();
    } catch (err) {
      Alert.alert("ตั้งค่าไม่สำเร็จ", errorMessage(err));
    }
  };

  const remove = (sound: LocalSound) => {
    Alert.alert(`ลบเสียง "${sound.name}"?`, "ลบจากเครื่องนี้เท่านั้น", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            stopPreview();
            await deleteSound(sound.id);
            await reload();
          } catch (err) {
            Alert.alert("ลบไม่สำเร็จ", errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <Screen refreshing={false} onRefresh={() => void reload()}>
      <SectionTitle subtitle="เก็บในเครื่องนี้เท่านั้น — ไม่อัปโหลดขึ้นเซิร์ฟเวอร์">คลังเสียงของเครื่อง</SectionTitle>
      <ErrorBanner message={error} />
      <Button title={importing ? "กำลังนำเข้า…" : "＋ เลือกไฟล์เสียงจากเครื่อง"} onPress={() => void upload()} disabled={importing} loading={importing} />
      <Card>
        {sounds === null ? (
          <Muted>กำลังโหลด…</Muted>
        ) : sounds.length === 0 ? (
          <EmptyState title="ยังไม่มีเสียง" description="กดปุ่มเพื่อเลือกไฟล์เสียงจากเครื่อง (mp3, wav, ogg, m4a — ไม่เกิน 25 MB)" />
        ) : (
          sounds.map((sound, index) => (
            <View key={sound.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Pressable onPress={() => void preview(sound)} style={styles.playButton}>
                <Text style={styles.playIcon}>{playingId === sound.id ? "■" : "▶"}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Text style={styles.name} numberOfLines={1}>
                    {sound.name}
                  </Text>
                  {defaultId === sound.id ? <Badge text="Default" tone="green" /> : null}
                  {sound.kind === "builtin" ? <Badge text="ในตัว" tone="gray" /> : null}
                </View>
                <Text style={styles.muted}>
                  {sound.kind === "builtin"
                    ? `เสียงสังเคราะห์ · ${sound.duration?.toFixed(1)}s`
                    : `${Math.max(1, Math.round(sound.size / 1024))} KB${sound.duration ? ` · ${sound.duration.toFixed(1)}s` : ""}`}
                </Text>
              </View>
              <View style={styles.actions}>
                {defaultId === sound.id ? null : (
                  <Button title="ตั้งเป็นค่าเริ่มต้น" size="sm" variant="secondary" onPress={() => void activate(sound)} />
                )}
                {sound.kind === "imported" ? (
                  <>
                    <Pressable onPress={() => startRename(sound)} hitSlop={8}>
                      <Text style={styles.rename}>เปลี่ยนชื่อ</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(sound)} hitSlop={8}>
                      <Text style={styles.delete}>ลบ</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          ))
        )}
      </Card>
      <Muted>เสียงทั้งหมดเก็บในเครื่อง (ไม่ sync ขึ้นเซิร์ฟเวอร์) — ใช้กับการเล่นเสียงเตือนในแอปนี้โดยตรง</Muted>

      {/* Rename dialog — works on both iOS and Android. */}
      <Modal visible={renameTarget !== null} transparent animationType="fade" onRequestClose={() => setRenameTarget(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setRenameTarget(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>เปลี่ยนชื่อเสียง</Text>
            <Input
              value={renameText}
              onChangeText={setRenameText}
              placeholder="ชื่อใหม่ (ไม่เกิน 60 ตัวอักษร)"
              maxLength={60}
              autoFocus
              onSubmitEditing={() => void commitRename()}
            />
            <View style={styles.modalActions}>
              <Button title="ยกเลิก" size="sm" variant="secondary" onPress={() => setRenameTarget(null)} disabled={renameSaving} />
              <Button
                title="บันทึก"
                size="sm"
                onPress={() => void commitRename()}
                disabled={!renameText.trim() || renameSaving}
                loading={renameSaving}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  playButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  playIcon: { color: "#fff", fontSize: 12 },
  name: { color: colors.text, fontWeight: "700", flexShrink: 1 },
  muted: { color: colors.textMuted, fontSize: 11 },
  actions: { alignItems: "flex-end", gap: spacing.xs },
  rename: { color: colors.info, fontWeight: "700", fontSize: 12 },
  delete: { color: colors.danger, fontWeight: "700", fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm, marginTop: spacing.xs },
});
