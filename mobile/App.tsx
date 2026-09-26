import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ConnectionProvider } from "./src/auth";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ensureBackend, initQuoteSource, maybeAutoPoll } from "./src/lib/local/backend";

export default function App() {
  // Boot the on-device backend (SQLite + seed + engines) as early as possible.
  useEffect(() => {
    try {
      ensureBackend();
      initQuoteSource();
    } catch (err) {
      console.error("[local-backend] init failed:", err);
    }
    // The local "worker": evaluate alert rules every 30s while the app is open.
    const pollTimer = setInterval(() => {
      try {
        maybeAutoPoll();
      } catch {
        // never crash for background polling
      }
    }, 30_000);

    return () => clearInterval(pollTimer);
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
