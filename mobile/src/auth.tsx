import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api/client";
import { DEFAULT_SERVER_URL } from "./config";

/**
 * Server connection context — authentication has been removed entirely.
 * The app remembers only which server it talks to; every API call is unauthenticated.
 */

export type ServerUser = { id: string; name: string; email: string };

type ConnectionContextValue = {
  ready: boolean;
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
  /** Server-side default user info (best-effort; not used for access control). */
  user: ServerUser | null;
  setUser: (user: ServerUser | null) => void;
};

const SERVER_KEY = "server.url";

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside <ConnectionProvider>");
  return ctx;
}

/** Back-compat alias for screens that used `useAuth`. */
export const useAuth = useConnection;

function normalizeServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_SERVER_URL;
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [serverUrl, setServerUrlState] = useState(DEFAULT_SERVER_URL);
  const [user, setUser] = useState<ServerUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(SERVER_KEY);
        if (!cancelled && saved) setServerUrlState(normalizeServerUrl(saved));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setServerUrl = useCallback(async (url: string) => {
    const normalized = normalizeServerUrl(url);
    await AsyncStorage.setItem(SERVER_KEY, normalized);
    setServerUrlState(normalized);
  }, []);

  const value = useMemo<ConnectionContextValue>(
    () => ({ ready, serverUrl, setServerUrl, user, setUser }),
    [ready, serverUrl, setServerUrl, user],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

/** Back-compat export name. */
export const AuthProvider = ConnectionProvider;
