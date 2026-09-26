import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from "expo-audio";
import * as DocumentPicker from "expo-document-picker";

/**
 * Local-only sound library — no server/API involved.
 *
 * - 4 built-in tones are generated as WAV data URIs (no bundled asset files needed).
 * - User imports audio files from the device with the document picker;
 *   small files are inlined as data URIs, larger ones are copied into the
 *   app's document directory and referenced by file:// URI.
 * - Everything persists in AsyncStorage; "activate" only changes local state.
 */

export type LocalSound = {
  id: string;
  name: string;
  /** data: or file: URI playable by expo-audio. */
  uri: string;
  kind: "builtin" | "imported";
  /** Approximate size in bytes (0 for built-ins). */
  size: number;
  duration: number | null;
};

const KEY_SOUNDS = "local.sounds.v1";
const KEY_DEFAULT = "local.defaultSoundId";
const KEY_VOLUME = "local.volume";
const KEY_MUTE = "local.muted";
const KEY_LAST_EVENT = "local.lastEventId";
const KEY_ALERT_SOUND = "local.alertSound";

/** Build a WAV file (16-bit PCM mono) and return a data: URI. */
function makeWavDataUri(freqs: number[], secondsPerTone: number, sampleRate = 22050, volume = 0.6): string {
  const samples: number[] = [];
  for (const f of freqs) {
    const n = Math.floor(sampleRate * secondsPerTone);
    for (let i = 0; i < n; i++) {
      const t = i / sampleRate;
      // Slight fade in/out to avoid clicks.
      const env = Math.min(1, t * 40, (secondsPerTone - t) * 40);
      samples.push(Math.sin(2 * Math.PI * f * t) * env * volume);
    }
  }
  const dataLength = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (const s of samples) {
    view.setInt16(offset, Math.max(-1, Math.min(1, s)) * 32767, true);
    offset += 2;
  }
  // Base64 the buffer.
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const BUILTINS: LocalSound[] = [
  { id: "builtin:ding", name: "Ding", uri: "", kind: "builtin", size: 0, duration: 0.4 },
  { id: "builtin:chime", name: "Chime", uri: "", kind: "builtin", size: 0, duration: 0.8 },
  { id: "builtin:alert", name: "Alert", uri: "", kind: "builtin", size: 0, duration: 0.9 },
  { id: "builtin:bell", name: "Bell", uri: "", kind: "builtin", size: 0, duration: 1.2 },
];

let builtinsReady = false;

function ensureBuiltins(): void {
  if (builtinsReady) return;
  BUILTINS[0]!.uri = makeWavDataUri([880], 0.35);
  BUILTINS[1]!.uri = makeWavDataUri([660, 990], 0.4);
  BUILTINS[2]!.uri = makeWavDataUri([740, 740, 988], 0.3);
  BUILTINS[3]!.uri = makeWavDataUri([523, 659, 784, 1047], 0.3);
  builtinsReady = true;
}

function newId(): string {
  return `snd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listSounds(): Promise<LocalSound[]> {
  ensureBuiltins();
  const raw = await AsyncStorage.getItem(KEY_SOUNDS);
  const imported: LocalSound[] = raw ? (JSON.parse(raw) as LocalSound[]) : [];
  return [...BUILTINS, ...imported];
}

function saveImported(sounds: LocalSound[]): Promise<void> {
  return AsyncStorage.setItem(KEY_SOUNDS, JSON.stringify(sounds));
}

export async function importSound(): Promise<LocalSound | null> {
  const pick = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
  if (pick.canceled || !pick.assets?.length) return null;
  const asset = pick.assets[0]!;
  const name = (asset.name ?? "เสียงของฉัน").replace(/\.[^.]+$/, "").slice(0, 60) || "เสียงของฉัน";

  const res = await fetch(asset.uri);
  const blob = await res.blob();
  if (blob.size > 10 * 1024 * 1024) {
    throw new Error("ไฟล์ใหญ่เกิน 10 MB");
  }
  // Inline as data URI — keeps everything self-contained and survives re-installs of caches.
  const dataUri = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    reader.readAsDataURL(blob);
  });

  const sound: LocalSound = {
    id: newId(),
    name,
    uri: dataUri,
    kind: "imported",
    size: blob.size,
    duration: null,
  };
  const raw = await AsyncStorage.getItem(KEY_SOUNDS);
  const imported: LocalSound[] = raw ? (JSON.parse(raw) as LocalSound[]) : [];
  imported.push(sound);
  await saveImported(imported);
  return sound;
}

export async function renameSound(id: string, name: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY_SOUNDS);
  const imported: LocalSound[] = raw ? (JSON.parse(raw) as LocalSound[]) : [];
  const target = imported.find((s) => s.id === id);
  if (!target) return; // built-ins keep their names
  target.name = name.trim().slice(0, 60) || target.name;
  await saveImported(imported);
}

export async function deleteSound(id: string): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY_SOUNDS);
  const imported: LocalSound[] = raw ? (JSON.parse(raw) as LocalSound[]) : [];
  const next = imported.filter((s) => s.id !== id);
  await saveImported(next);
  if ((await getDefaultSoundId()) === id) {
    await AsyncStorage.removeItem(KEY_DEFAULT);
  }
}

export async function getDefaultSoundId(): Promise<string | null> {
  return AsyncStorage.getItem(KEY_DEFAULT);
}

export async function setDefaultSound(id: string): Promise<void> {
  await AsyncStorage.setItem(KEY_DEFAULT, id);
}

/** Per-alert override (alertId → soundId); null entry means "use default". */
export async function getAlertSoundId(alertId: string): Promise<string | null | undefined> {
  const raw = await AsyncStorage.getItem(KEY_ALERT_SOUND);
  const map: Record<string, string | null> = raw ? JSON.parse(raw) : {};
  return map[alertId];
}

export async function saveAlertSoundId(alertId: string, soundId: string | null): Promise<void> {
  const raw = await AsyncStorage.getItem(KEY_ALERT_SOUND);
  const map: Record<string, string | null> = raw ? JSON.parse(raw) : {};
  if (soundId === undefined) delete map[alertId];
  else map[alertId] = soundId;
  await AsyncStorage.setItem(KEY_ALERT_SOUND, JSON.stringify(map));
}

export async function getVolume(): Promise<number> {
  const raw = await AsyncStorage.getItem(KEY_VOLUME);
  const v = raw ? Number(raw) : 0.8;
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.8;
}

export async function setVolume(v: number): Promise<void> {
  await AsyncStorage.setItem(KEY_VOLUME, String(Math.min(1, Math.max(0, v))));
}

export async function isMuted(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEY_MUTE)) === "1";
}

export async function setMuted(muted: boolean): Promise<void> {
  await AsyncStorage.setItem(KEY_MUTE, muted ? "1" : "0");
}

let playerRef: AudioPlayer | null = null;

/** Preview (play/stop) a sound by id; resolves when playback finishes or stops. */
export async function previewSound(sound: LocalSound, currentlyPlayingId: string | null): Promise<string | null> {
  if (currentlyPlayingId === sound.id) {
    stopPreview();
    return null;
  }
  stopPreview();
  const player = createAudioPlayer({ uri: sound.uri });
  try {
    const vol = await getVolume();
    player.volume = await isMuted() ? 0 : vol;
    player.play();
    playerRef = player;
    return sound.id;
  } catch (err) {
    try {
      player.remove();
    } catch {
      // ignore
    }
    throw err;
  }
}

export function stopPreview(): void {
  try {
    playerRef?.pause();
    playerRef?.remove();
  } catch {
    // ignore
  }
  playerRef = null;
}

/** Fire-and-forget: play the default (or per-alert) sound for a freshly triggered alert. */
export async function playForAlert(alertId?: string, alertSoundId?: string | null): Promise<void> {
  try {
    if (await isMuted()) return;
    let id = alertSoundId !== undefined ? alertSoundId : alertId ? await getAlertSoundId(alertId) : undefined;
    if (id === undefined) id = await getDefaultSoundId();
    const sounds = await listSounds();
    const sound = id ? sounds.find((s) => s.id === id) : undefined;
    const chosen = sound ?? sounds[0];
    if (!chosen) return;
    const player = createAudioPlayer({ uri: chosen.uri });
    player.volume = await getVolume();
    player.play();
    playerRef = player;
    player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      if (status.didJustFinish) {
        try {
          player.remove();
        } catch {
          // ignore
        }
        if (playerRef === player) playerRef = null;
      }
    });
  } catch {
    // never crash the app for a sound
  }
}

/** Dedupe helper for dashboard polling: returns true only the first time an event id is seen. */
export async function shouldAnnounceEvent(eventId: string): Promise<boolean> {
  const last = await AsyncStorage.getItem(KEY_LAST_EVENT);
  await AsyncStorage.setItem(KEY_LAST_EVENT, eventId);
  return last !== eventId;
}

/** Remove all imported sounds (built-ins stay). */
export async function resetImportedSounds(): Promise<void> {
  await AsyncStorage.removeItem(KEY_SOUNDS);
}
