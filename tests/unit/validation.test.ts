import { describe, expect, it } from "vitest";
import { createAlertSchema, registerSchema, addToWatchlistSchema } from "@/lib/validation/schemas";
import { sanitizeFileName } from "../../src/lib/security/upload";

describe("validation schemas", () => {
  it("accepts a valid alert", () => {
    const parsed = createAlertSchema.safeParse({
      assetId: "a1", name: "QQQM buy", type: "ENTRY", condition: "BELOW_OR_EQUAL",
      targetPrice: 180, oneTime: false, cooldownMinutes: 60, enabled: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects non-positive target price", () => {
    const parsed = createAlertSchema.safeParse({
      assetId: "a1", name: "x", type: "ENTRY", condition: "BELOW_OR_EQUAL", targetPrice: -5,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects weak passwords", () => {
    expect(registerSchema.safeParse({ name: "Test", email: "a@b.com", password: "12345678" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Test", email: "a@b.com", password: "abcdefgh" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Test", email: "a@b.com", password: "abcd1234" }).success).toBe(true);
  });

  it("normalizes symbols", () => {
    expect(addToWatchlistSchema.parse({ symbol: "aapl" }).symbol).toBe("AAPL");
  });
});

describe("sanitizeFileName", () => {
  it("strips path traversal", () => {
    expect(sanitizeFileName("../../etc/passwd")).not.toContain("/");
    expect(sanitizeFileName("C:\\evil\\x.mp3")).not.toContain("\\");
  });
  it("keeps normal names", () => {
    expect(sanitizeFileName("my alert sound.mp3")).toBe("my alert sound.mp3");
  });
});
