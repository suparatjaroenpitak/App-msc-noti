"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/client";

export type SystemStatus = {
  db: boolean;
  pushConfigured: boolean;
  marketDataProvider: string;
  marketDataProviderHealthy: boolean;
  market: { state: "OPEN" | "CLOSED" | "PRE" | "POST"; label: string };
  timestamp: string;
};

export function useSystemStatus(pollMs = 60_000): { status: SystemStatus | null; error: string | null } {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setStatus(await apiFetch<SystemStatus>("/api/system/status"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "status failed");
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { status, error };
}
