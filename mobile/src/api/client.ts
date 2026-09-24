import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_SERVER_URL } from "../config";

const TOKEN_KEY = "stock_alert_token";
const SERVER_KEY = "stock_alert_server_url";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let cachedToken: string | null = null;
let cachedServer: string | null = null;

export function normalizeServerUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export function getServerUrl(): string {
  return cachedServer?.trim() ? cachedServer.replace(/\/+$/, "") : DEFAULT_SERVER_URL;
}

export async function restoreSession(): Promise<{ token: string | null; serverUrl: string | null }> {
  const [token, serverUrl] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(SERVER_KEY),
  ]);
  cachedToken = token;
  cachedServer = serverUrl;
  return { token, serverUrl };
}

export async function persistToken(token: string | null): Promise<void> {
  cachedToken = token;
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

export async function persistServerUrl(url: string): Promise<void> {
  cachedServer = url;
  await AsyncStorage.setItem(SERVER_KEY, url);
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

export function authHeaders(): Record<string, string> {
  return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

/** Fetch against the configured server, unwrapping the { ok, data } envelope. */
export async function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const url = `${getServerUrl()}${path}`;
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  if (init?.body !== undefined && !isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      body:
        init?.body === undefined
          ? undefined
          : isFormData
            ? (init.body as FormData)
            : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", `เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ (${getServerUrl()})`);
  }

  let json: Envelope<T> | null = null;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError(res.status, "BAD_RESPONSE", `การตอบกลับผิดรูปแบบ (${res.status})`);
  }

  if (!json || !json.ok) {
    const err = json && !json.ok ? json.error : null;
    let message = err?.message ?? `เกิดข้อผิดพลาด (${res.status})`;
    if (Array.isArray(err?.details)) {
      const lines = (err.details as Array<{ path: string; message: string }>)
        .map((d) => `${d.path}: ${d.message}`)
        .join(", ");
      if (lines) message = lines;
    }
    throw new ApiError(res.status, err?.code ?? "ERROR", message);
  }
  return json.data;
}
