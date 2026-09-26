import React, { createContext, useContext, useMemo } from "react";

/**
 * Connection context — the whole backend now runs on-device.
 * No server URL exists anymore; this only carries mode info for the UI.
 */

export type ServerUser = { id: string; name: string; email: string };

type ConnectionContextValue = {
  ready: boolean;
  serverUrl: string;
  /** Always "local" — kept so screens don't need changes. */
  user: ServerUser | null;
  /** No-op (kept for screens that still call it). */
  refreshUser: () => void;
};

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

export function useConnection(): ConnectionContextValue {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnection must be used inside <ConnectionProvider>");
  return ctx;
}

/** Back-compat alias. */
export const useAuth = useConnection;

const LOCAL_USER: ServerUser = { id: "local", name: "โหมดในเครื่อง", email: "local://device" };

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<ConnectionContextValue>(
    () => ({ ready: true, serverUrl: "local://device", user: LOCAL_USER, refreshUser: () => {} }),
    [],
  );

  return <ConnectionContext.Provider value={value}>{children}</ConnectionContext.Provider>;
}

/** Back-compat export name. */
export const AuthProvider = ConnectionProvider;
