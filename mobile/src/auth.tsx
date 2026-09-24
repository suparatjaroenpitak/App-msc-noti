import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  api,
  normalizeServerUrl,
  persistServerUrl,
  persistToken,
  restoreSession,
} from "./api/client";
import { DEFAULT_SERVER_URL } from "./config";

export type AuthUser = { id: string; name: string; email: string };

type AuthContextValue = {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
  serverUrl: string;
  login: (email: string, password: string, serverUrl: string) => Promise<void>;
  logout: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [serverUrl, setServerUrlState] = useState<string>(DEFAULT_SERVER_URL);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await restoreSession();
      if (cancelled) return;
      setToken(restored.token);
      setServerUrlState(restored.serverUrl ?? DEFAULT_SERVER_URL);
      if (restored.token) {
        try {
          const data = await api<{ user: AuthUser }>("/api/auth/me");
          if (!cancelled) setUser(data.user);
        } catch (err) {
          // Token invalid/expired → drop it and show the login screen.
          if (err instanceof ApiError && err.status === 401) {
            await persistToken(null);
            if (!cancelled) setToken(null);
          }
        }
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, rawServerUrl: string) => {
    const url = normalizeServerUrl(rawServerUrl);
    await persistServerUrl(url);
    setServerUrlState(url);
    const data = await api<{ token: string; user: AuthUser }>("/api/auth/token", {
      method: "POST",
      body: { email, password },
    });
    await persistToken(data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/token", { method: "DELETE" });
    } catch {
      // Server-side revoke is best effort; the local token is dropped regardless.
    }
    await persistToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const setServerUrl = useCallback(async (url: string) => {
    const normalized = normalizeServerUrl(url);
    await persistServerUrl(normalized);
    setServerUrlState(normalized);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ready, token, user, serverUrl, login, logout, setServerUrl }),
    [ready, token, user, serverUrl, login, logout, setServerUrl],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
