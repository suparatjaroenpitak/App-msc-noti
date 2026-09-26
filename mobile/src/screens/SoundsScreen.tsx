import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";
import { api, authHeaders, getServerUrl } from "../api/client";
import { useApi, errorMessage } from "../hooks/useApi";
import { Badge, Button, Card, EmptyState, ErrorBanner, Muted, Screen, SectionTitle, Spinner } from "../components/ui";
import type { SoundRow } from "../api/types";
import { colors, spacing } from "../theme";

export function SoundsScreen() {
  const { data, error, loading, reload } = useApi<{ sounds: SoundRow[] }>("/api/notification-sounds");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const playerSoundRef = useRef<string | null>(null);

  const upload = async () => {
    setUploadError(null);
    try {
      const pick = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
      if (pick.canceled || pick.assets.length === 0) return;
      const asset = pick.assets[0];
      if (asset.size && asset.size > 10 * 1024 * 1024) {
        setUploadError("ไฟล์ใหญ่เกิน 10 MB");
        return;
      }
      setUploading(true);
      const form = new FormData();
      form.append("file", { uri: asset.uri, name: asset.name ?? "sound.mp3", type: asset.mimeType ?? "audio/mpeg" } as unknown as Blob);
      form.append("name", (asset.name ?? "เสียงของฉัน").replace(/\.[^.]+$/, "").slice(0, 60));
      await api("/api/notification-sounds", { method: "POST", body: form });
      reload();
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const rename = (sound: SoundRow) => {
    Alert.prompt(
      "เปลี่ยนชื่อเสียง",
      "ชื่อใหม่ (ไม่เกิน 60 ตัวอักษร)",
      async (text) => {
        const trimmed = (text ?? "").trim();
        if (!trimmed) return;
        try {
          setBusyId(sound.id);
          await api(`/api/notification-sounds/${sound.id}`, { method: "PATCH", body: { name: trimmed.slice(0, 60) } });
          reload();
        } catch (err) {
          Alert.alert("เปลี่ยนชื่อไม่สำเร็จ", errorMessage(err));
        } finally {
          setBusyId(null);
        }
      },
      "plain-text",
      sound.name,
    );
  };

  const stop = useCallback(() => {
    try {
      playerRef.current?.pause();
    } catch {
      // player already released
    }
    setPlayingId(null);
    playerSoundRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.remove();
      } catch {
        // ignore
      }
    };
  }, []);

  const preview = (sound: SoundRow) => {
    if (playerSoundRef.current === sound.id && playingId === sound.id) {
      stop();
      return;
    }
    try {
      playerRef.current?.remove();
    } catch {
      // ignore
    }
    try {
      // Sound files are private per user → attach the bearer token.
      const player = createAudioPlayer({
        uri: `${getServerUrl()}${sound.fileUrl}`,
        headers: authHeaders(),
      });
      playerRef.current = player;
      playerSoundRef.current = sound.id;
      player.play();
      setPlayingId(sound.id);
      player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
        if (status.didJustFinish) setPlayingId(null);
      });
    } catch (err) {
      setPlayingId(null);
      Alert.alert("เล่นเสียงไม่ได้", errorMessage(err));
    }
  };

  const activate = async (sound: SoundRow) => {
    setBusyId(sound.id);
    try {
      await api(`/api/notification-sounds/${sound.id}/activate`, { method: "POST" });
      reload();
    } catch (err) {
      Alert.alert("ตั้งค่าไม่สำเร็จ", errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const remove = (sound: SoundRow) => {
    Alert.alert(`ลบเสียง "${sound.name}"?`, "Alert ที่ใช้เสียงนี้จะกลับไปใช้เสียงเริ่มต้น", [
      { text: "ยกเลิก", style: "cancel" },
      {
        text: "ลบ",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`/api/notification-sounds/${sound.id}`, { method: "DELETE" });
            reload();
          } catch (err) {
            Alert.alert("ลบไม่สำเร็จ", errorMessage(err));
          }
        },
      },
    ]);
  };

  const sounds = data?.sounds ?? [];

  return (
    <Screen refreshing={loading} onRefresh={reload}>
      <SectionTitle subtitle="เสียงจะเล่นเมื่อแอป/เว็บเปิดอยู่ — เบื้องหลังใช้เสียงระบบ">
        คลังเสียง
      </SectionTitle>
      <ErrorBanner message={uploadError} />
      <Button title={uploading ? "กำลังอัปโหลด…" : "＋ เลือกไฟล์เสียงจากเครื่อง"} onPress={upload} disabled={uploading} />
      <Card>
        {loading && data === null ? (
          <Spinner />
        ) : sounds.length === 0 ? (
          <EmptyState title="ยังไม่มีเสียง" description="กดปุ่มด้านล่างเพื่อเลือกไฟล์เสียงจากเครื่อง (mp3, wav, ogg, m4a — ไม่เกิน 10 MB)" />
        ) : (
          sounds.map((sound, index) => (
            <View key={sound.id} style={[styles.row, index > 0 && styles.rowBorder]}>
              <Pressable onPress={() => preview(sound)} style={styles.playButton}>
                <Text style={styles.playIcon}>{playingId === sound.id ? "■" : "▶"}</Text>
              </Pressable>
              <View style={{ flex: 1 }}>
                <View style={styles.inline}>
                  <Text style={styles.name} numberOfLines={1}>
                    {sound.name}
                  </Text>
                  {sound.isDefault ? <Badge text="Default" tone="green" /> : null}
                </View>
                <Text style={styles.muted}>
                  {sound.mimeType} · {Math.round(sound.fileSize / 1024)} KB
                  {sound.duration ? ` · ${sound.duration.toFixed(1)}s` : ""}
                </Text>
              </View>
              <View style={styles.actions}>
                {sound.isDefault ? null : (
                  <Button
                    title="ตั้งเป็นค่าเริ่มต้น"
                    size="sm"
                    variant="secondary"
                    loading={busyId === sound.id}
                    onPress={() => void activate(sound)}
                  />
                )}
                <Pressable onPress={() => rename(sound)} hitSlop={8}>
                  <Text style={styles.rename}>เปลี่ยนชื่อ</Text>
                </Pressable>
                <Pressable onPress={() => remove(sound)} hitSlop={8}>
                  <Text style={styles.delete}>ลบ</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>
      <Muted>รองรับ mp3, wav, ogg, m4a — ไม่เกิน 10 MB / 30 วินาที · เสียงที่อัปโหลดใช้ได้ทั้งแอปและเว็บทันที</Muted>
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
});
