"use client";

let sharedAudio: HTMLAudioElement | null = null;

/**
 * Play a notification sound in the foreground (page visible).
 * Note: browsers require a prior user interaction before allowing audio playback.
 * When the app is backgrounded, custom sounds may not play — the OS notification
 * sound is used instead (see Browser Limitation Notice in the Sounds page).
 */
export function playNotificationSound(url: string | null, volume = 0.8): void {
  try {
    if (sharedAudio) {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    }
    sharedAudio = new Audio(url ?? "/sounds/chime.wav");
    sharedAudio.volume = Math.max(0, Math.min(1, volume));
    void sharedAudio.play().catch(() => {
      // Autoplay blocked or unsupported format — silent fallback (OS sound handles the rest).
    });
  } catch {
    /* ignore */
  }
}

/** Ask the user for the interaction browsers need before allowing audio. */
export function primeAudioOnUserGesture(): void {
  const a = new Audio("/sounds/chime.wav");
  a.volume = 0;
  void a.play().then(
    () => a.pause(),
    () => undefined,
  );
}
