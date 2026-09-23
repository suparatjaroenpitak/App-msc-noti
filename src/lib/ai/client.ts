import { HttpError } from "@/lib/api/response";

/** Validate + normalize a user-provided Ollama base URL (SSRF guard). */
export function assertSafeOllamaUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new HttpError(400, "BAD_REQUEST", "URL ไม่ถูกต้อง (ต้องเป็น http/https พร้อมโดเมน เช่น https://xxxx.trycloudflare.com)");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new HttpError(400, "BAD_REQUEST", "ต้องใช้ http/https เท่านั้น");
  }
  if (u.username || u.password) {
    throw new HttpError(400, "BAD_REQUEST", "ไม่อนุญาต URL ที่มี credentials");
  }
  if (u.pathname !== "/" && u.pathname !== "") {
    throw new HttpError(400, "BAD_REQUEST", "ต้องเป็น base URL เท่านั้น (ไม่ต้องมี path)");
  }

  const host = u.hostname.toLowerCase();
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  const allowedSuffixes = ["trycloudflare.com", "loca.lt", "ngrok-free.app", "ngrok.io", "colab.ngrok.io"];
  const isAllowedTunnel = allowedSuffixes.some((s) => host === s || host.endsWith("." + s));
  const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "0.0.0.0";
  const isDev = process.env.NODE_ENV !== "production";

  // Local dev Ollama may use its default port; tunnels must use standard ports.
  if (!isDev && isAllowedTunnel && port !== "80" && port !== "443") {
    throw new HttpError(400, "BAD_REQUEST", "Tunnel URL ต้องใช้ port 80/443 เท่านั้น");
  }
  if (isLocalhost && port !== "80" && port !== "443" && port !== "11434" && !isDev) {
    throw new HttpError(400, "BAD_REQUEST", "ไม่อนุญาต port พิเศษ");
  }

  // Production: only HTTPS tunnel hosts. Development: also allow local Ollama.
  if (!isDev) {
    if (u.protocol !== "https:" || !isAllowedTunnel) {
      throw new HttpError(400, "BAD_REQUEST", "Production รองรับเฉพาะ HTTPS tunnel URL (เช่น *.trycloudflare.com)");
    }
  } else if (!isLocalhost && !isAllowedTunnel) {
    throw new HttpError(400, "BAD_REQUEST", "อนุญาตเฉพาะ localhost หรือ tunnel domains (trycloudflare/loca.lt/ngrok)");
  }

  return u;
}

export function normalizeBaseUrl(raw: string): string {
  const u = assertSafeOllamaUrl(raw);
  const proto = u.protocol.replace(":", "");
  return `${proto}://${u.host}`;
}

async function ollamaFetch(url: string, timeoutMs: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } finally {
    clearTimeout(t);
  }
}

/** Small client for the subset of the Ollama REST API we need. */
export class OllamaClient {
  async listModels(baseUrl: string, timeoutMs: number): Promise<string[]> {
    const res = await ollamaFetch(`${normalizeBaseUrl(baseUrl)}/api/tags`, timeoutMs);
    if (!res.ok) throw new HttpError(502, "INTERNAL_ERROR", `Ollama ตอบกลับ ${res.status}`);
    const json = (await res.json()) as { models?: Array<{ name: string }> };
    return (json.models ?? []).map((m) => m.name);
  }

  async generate(baseUrl: string, model: string, prompt: string, options: { temperature: number; timeoutMs: number }): Promise<string> {
    const res = await ollamaFetch(`${normalizeBaseUrl(baseUrl)}/api/generate`, options.timeoutMs, {
      method: "POST",
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: { temperature: options.temperature, num_ctx: 8192 },
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new HttpError(502, "INTERNAL_ERROR", `Ollama error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { response?: string };
    if (!json.response) throw new HttpError(502, "INTERNAL_ERROR", "Ollama ไม่ส่ง response กลับมา");
    return json.response;
  }
}

export const ollama = new OllamaClient();
