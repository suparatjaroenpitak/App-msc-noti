export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string; details?: unknown } };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  let json: Envelope<T>;
  try {
    json = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(res.status, "INTERNAL_ERROR", `Unexpected response (${res.status})`);
  }

  if (!json.ok) {
    const detailMessage =
      json.error.details && Array.isArray(json.error.details)
        ? (json.error.details as Array<{ path: string; message: string }>)
            .map((d) => `${d.path}: ${d.message}`)
            .join(", ")
        : undefined;
    throw new ApiClientError(res.status, json.error.code, detailMessage || json.error.message, json.error.details);
  }
  return json.data;
}
