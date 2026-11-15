import React, { useEffect } from "react";
import { AppState } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConnectionProvider } from "./src/auth";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ensureBackend, initQuoteSource, maybeAutoPoll } from "./src/lib/local/backend";
import { configureLocalNotifications, requestLocalNotificationPermission } from "./src/lib/local/notifications";

export default function App() {
  // Boot the on-device backend (SQLite + seed + engines) as early as possible.
  useEffect(() => {
    let cancelled = false;
    try {
      ensureBackend();
      initQuoteSource();
      void configureLocalNotifications()
        .then(() => {
          if (!cancelled) void requestLocalNotificationPermission();
        })
        .catch((err) => console.warn("[local-notifications] init failed", err));
      // Do not wait for the first 30-second timer before evaluating a newly
      // opened app. The poller still respects the market-hours guard.
      void maybeAutoPoll();
    } catch (err) {
      console.error("[local-backend] init failed:", err);
    }

    // The local "worker": evaluate alert rules every 30s while the app is open.
    const pollTimer = setInterval(() => {
      void maybeAutoPoll();
    }, 30_000);

    // React Native timers are paused while backgrounded. Run an immediate
    // check when the user returns so a missed interval is not lost.
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void maybeAutoPoll();
    });

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      appState.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ConnectionProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </ConnectionProvider>
    </SafeAreaProvider>
  );
}
