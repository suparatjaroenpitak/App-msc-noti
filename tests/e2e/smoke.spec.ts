import { test, expect } from "@playwright/test";

// E2E smoke: assumes `npm run dev` with seeded DB and MARKET_DATA_PROVIDER=mock.
// Run: npm run test:e2e

test.describe("Stock Alert PWA smoke", () => {
  test("register → watchlist → create alert", async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`;

    await page.goto("/register");
    await page.getByLabel("ชื่อ").fill("E2E User");
    await page.getByLabel("อีเมล").fill(email);
    await page.getByLabel("รหัสผ่าน").fill("e2epass123");
    await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
    await page.waitForURL("**/dashboard", { timeout: 15000 });

    // Watchlist: search & add AAPL
    await page.goto("/watchlist");
    await page.getByPlaceholder(/ค้นหาหุ้น/).fill("AAPL");
    await page.getByRole("button", { name: /เพิ่ม/ }).first().click();
    await expect(page.getByText("AAPL")).toBeVisible();

    // Create alert
    await page.goto("/alerts/create");
    await page.getByPlaceholder(/ค้นหา เช่น/).fill("AAPL");
    await page.getByRole("button", { name: "AAPL" }).first().click();
    await page.getByLabel("ชื่อ Alert").fill("E2E alert");
    await page.getByLabel("ราคาเป้าหมาย").fill("1.00");
    await page.getByRole("button", { name: "สร้าง Alert" }).click();
    await page.waitForURL("**/alerts", { timeout: 15000 });
    await expect(page.getByText("E2E alert")).toBeVisible();
  });

  test("PWA manifest and service worker are served", async ({ page }) => {
    const res = await page.request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    expect(manifest.display).toBe("standalone");

    const sw = await page.request.get("/sw.js");
    expect(sw.ok()).toBeTruthy();
  });
});
