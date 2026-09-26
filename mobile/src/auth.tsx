import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { api } from "./api/client";
import { DEFAULT_SERVER_URL } from "./config";

/**
 * Connection context — the server URL is FIXED in src/config.ts.
 * There is no server-switching UI and no authentication (auth removed).
 */

export type ServerUser = { id: string; name: string; email: string };

type ConnectionContextValue = {
  ready: boolean;
  serverUrl: string;
  /** Server-side default user info (best-effort; not used for access control). */
  user: ServerUser | null;
  /** Re-fetch the server's default user info. */
  refreshUser: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside <ConnectionProvider>");
  return ctx;
}

/** Back-compat alias for screens that used `useAuth`. */
export const useAuth = useConnection;

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ServerUser | null>(null);

  // Best-effort fetch of the server's default user info (for the server info screen).
  const loadUser = useCallback(() => {
    api<{ user: ServerUser }>("/api/auth-user")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  const value = useMemo<ConnectionContextValue>(
    () => ({ ready: true, serverUrl: DEFAULT_SERVER_URL, user, refreshUser: loadUser }),
    [user, loadUser],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

/** Back-compat export name. */
export const AuthProvider = ConnectionProvider;
