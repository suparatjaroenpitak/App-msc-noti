"use client";

import { useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import { playNotificationSound } from "@/hooks/use-sound";

type PushData = {
  title?: string;
  body?: string;
  symbol?: string;
  url?: string;
  soundUrl?: string | null;
};

/**
 * Registers /sw.js and:
 *  - listens for the SW push event mirrored to pages via postMessage,
 *  - plays the custom sound while the app is in the FOREGROUND,
 *  - surfaces a toast as a backup for browsers that suppress the native notification.
 * Background delivery is handled entirely by the SW (system sound — see Sounds page notice).
 */
export function PushProvider() {
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_RECEIVED") {
        const data = event.data.payload as PushData;
        // Foreground: play custom sound (allowed after user interaction) + show UI.
        playNotificationSound(data?.soundUrl ?? null, 0.8);
        toast.push("info", `${data?.title ?? "Stock Alert"} — ${data?.body ?? ""}`);
      }
      if (event.data?.type === "NOTIFICATION_CLICK") {
        // SW already navigates; nothing to do here.
      }
    };

    navigator.serviceWorker?.addEventListener("message", onMessage);

    navigator.serviceWorker
      ?.register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        // Listen to push while a page is open so we can play the custom sound.
        // (push event in SW forwards to clients via postMessage)
        void reg;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [toast]);

  return null;
}
