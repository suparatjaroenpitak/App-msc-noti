import { DEFAULT_SERVER_URL } from "../config";

/**
 * API client — the server URL is fixed in src/config.ts (no switching UI).
 * Authentication has been removed entirely; all calls are unauthenticated.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Fixed server URL (no per-device override). */
export function getServerUrl(): string {
  return DEFAULT_SERVER_URL;
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

export function authHeaders(): Record<string, string> {
  return {};
}

/** Fetch against the fixed server, unwrapping the { ok, data } envelope. */
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
