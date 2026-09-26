import { handleLocalApi, ensureBackend, type LocalResponse } from "../lib/local/backend";

/**
 * API client — every call is served by the ON-DEVICE backend (SQLite +
 * local market data + local alert engine). There is no network fallback:
 * the whole service used to live on Render and now lives inside the app.
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

/** Kept for compatibility — the app is fully local now. */
export function getServerUrl(): string {
  return "local://device";
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

export function authHeaders(): Record<string, string> {
  return {};
}

function toApiError(res: LocalResponse<never> | { ok: false; status: number; code: string; message: string }): ApiError {
  const message = "message" in res ? res.message : "เกิดข้อผิดพลาด";
  const status = "status" in res ? res.status : 500;
  const code = "code" in res ? res.code : "ERROR";
  return new ApiError(status, code, message);
}

/** Serve an API call from the local backend, unwrapping the { ok, data } envelope. */
export async function api<T>(
  path: string,
  init?: Omit<RequestInit, "body"> & { body?: unknown },
): Promise<T> {
  const method = init?.method ?? "GET";
  ensureBackend();

  const local = handleLocalApi<T>(method, path, init?.body);
  if (local === null) {
    throw new ApiError(404, "NOT_FOUND", `ไม่รองรับคำสั่งนี้ในโหมด local: ${method} ${path}`);
  }
  if (!local.ok) {
    throw toApiError(local as LocalResponse<never> & { ok: false });
  }
  return local.data;
}
