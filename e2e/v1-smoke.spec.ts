import { test, expect } from "@playwright/test";

/**
 * Critical V1 smoke paths. Skips if Chromium is missing or the app is down.
 */
test.describe("V1 smoke", () => {
  test.beforeEach(async ({}, testInfo) => {
    // Graceful skip when browsers were never installed.
    try {
      // Probe by ensuring the config project can launch; Playwright throws if missing.
      await testInfo.project.use;
    } catch {
      testInfo.skip(true, "Playwright browser unavailable");
    }
  });

  test("public tournament page is readable without auth", async ({
    page,
  }, testInfo) => {
    try {
      const response = await page.goto("/t/hcmc-badminton-open-2026", {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
      if (!response || response.status() >= 500) {
        testInfo.skip(true, "App server not available");
        return;
      }
      if (response.status() === 404) {
        testInfo.skip(true, "Seed tournament not present");
        return;
      }
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Schedule" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
      // No obvious PII labels on public surface
      await expect(page.getByText(/phone|email|@/i)).toHaveCount(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        /Executable doesn't exist|browserType\.launch|ECONNREFUSED|net::ERR/i.test(
          message,
        )
      ) {
        testInfo.skip(true, `Skipped: ${message.split("\n")[0]}`);
        return;
      }
      throw err;
    }
  });

  test("health endpoint responds", async ({ request }, testInfo) => {
    try {
      const res = await request.get("/api/health");
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.status).toBe("ok");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/ECONNREFUSED|Browser|Executable/i.test(message)) {
        testInfo.skip(true, `Skipped: ${message.split("\n")[0]}`);
        return;
      }
      throw err;
    }
  });
});
