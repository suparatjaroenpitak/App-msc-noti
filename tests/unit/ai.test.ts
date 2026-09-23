import { afterEach, describe, expect, it } from "vitest";
import { assertSafeOllamaUrl } from "@/lib/ai/client";
import { parseSuggestion } from "@/lib/ai/analysis";

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
function setNodeEnv(value: string | undefined): void {
  Object.defineProperty(process.env, "NODE_ENV", { value, configurable: true, writable: true });
}
afterEach(() => {
  setNodeEnv(ORIGINAL_NODE_ENV);
});

describe("assertSafeOllamaUrl (SSRF guard)", () => {
  it("accepts a trycloudflare HTTPS URL in production", () => {
    setNodeEnv("production");
    const u = assertSafeOllamaUrl("https://my-tunnel.trycloudflare.com");
    expect(u.hostname).toBe("my-tunnel.trycloudflare.com");
  });

  it("rejects internal addresses in production", () => {
    setNodeEnv("production");
    expect(() => assertSafeOllamaUrl("http://169.254.169.254")).toThrow();
    expect(() => assertSafeOllamaUrl("http://localhost:11434")).toThrow();
    expect(() => assertSafeOllamaUrl("http://192.168.1.10:11434")).toThrow();
  });

  it("allows localhost in development", () => {
    setNodeEnv("development");
    expect(assertSafeOllamaUrl("http://localhost:11434").hostname).toBe("localhost");
  });

  it("rejects URLs with credentials or a path", () => {
    setNodeEnv("production");
    expect(() => assertSafeOllamaUrl("https://user:pass@tunnel.trycloudflare.com")).toThrow();
    expect(() => assertSafeOllamaUrl("https://tunnel.trycloudflare.com/api")).toThrow();
  });

  it("rejects non-tunnel domains in production", () => {
    setNodeEnv("production");
    expect(() => assertSafeOllamaUrl("https://evil.com")).toThrow();
  });
});

describe("parseSuggestion", () => {
  it("parses a clean JSON reply", () => {
    const parsed = parseSuggestion(
      JSON.stringify({
        suggestedEntryPrice: 179.5, suggestedStopPrice: 172, suggestedTargetPrice: 190,
        confidence: 0.7, horizonDays: 14, verdict: "BUY", rationale: "ตัวอย่างเหตุผล",
      }),
    );
    expect(parsed.suggestedEntryPrice).toBe(179.5);
    expect(parsed.verdict).toBe("BUY");
    expect(parsed.horizonDays).toBe(14);
    expect(parsed.confidence).toBe(0.7);
  });

  it("extracts JSON embedded in prose", () => {
    const parsed = parseSuggestion(
      'แน่นอน นี่คือผลลัพธ์: {"suggestedEntryPrice": 100, "verdict": "WAIT", "rationale": "รอก่อน"}',
    );
    expect(parsed.suggestedEntryPrice).toBe(100);
    expect(parsed.verdict).toBe("WAIT");
  });

  it("throws when no usable entry price", () => {
    expect(() => parseSuggestion('{"verdict": "WAIT"}')).toThrow();
  });

  it("maps unknown verdicts to null", () => {
    const parsed = parseSuggestion('{"suggestedEntryPrice": 50, "verdict": "MAYBE"}');
    expect(parsed.verdict).toBeNull();
  });
});
