import { test, expect, chromium } from "@playwright/test";

/**
 * Happy-path draw flow. Skipped unless PLAYWRIGHT_E2E=1 and Chromium launches.
 *
 * Prerequisites when enabling:
 * - App running at PLAYWRIGHT_BASE_URL (default http://127.0.0.1:3000)
 * - Seeded event in DRAW_READY with active entries + GROUP stage
 * - Operator/admin credentials if auth gate applies
 */
async function chromiumAvailable(): Promise<boolean> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
    return true;
  } catch {
    return false;
  }
}

test.describe("draw flow", () => {
  test("generate → manual move → validate → confirm", async ({ page }) => {
    test.skip(
      process.env.PLAYWRIGHT_E2E !== "1",
      "Set PLAYWRIGHT_E2E=1 to run against a live app + seeded DRAW_READY event",
    );
    test.skip(
      !(await chromiumAvailable()),
      "Chromium not installed — run: pnpm exec playwright install chromium",
    );

    const tournamentId = process.env.E2E_TOURNAMENT_ID;
    const eventId = process.env.E2E_EVENT_ID;
    test.skip(
      !tournamentId || !eventId,
      "Set E2E_TOURNAMENT_ID and E2E_EVENT_ID for a DRAW_READY event",
    );

    await page.goto(
      `/admin/tournaments/${tournamentId}/events/${eventId}/draw`,
    );

    await expect(page.getByRole("heading", { name: "Draw" })).toBeVisible();
    await page.getByRole("button", { name: "Generate draw" }).click();
    await expect(page.getByText(/Draw generated/i)).toBeVisible({
      timeout: 15_000,
    });

    // Prefer mobile select-move so DnD pointers are not required.
    const firstSelect = page.locator('select[aria-label^="Move"]').first();
    if (await firstSelect.isVisible()) {
      const options = firstSelect.locator("option");
      const count = await options.count();
      if (count > 1) {
        const nextValue = await options.nth(1).getAttribute("value");
        if (nextValue) {
          await firstSelect.selectOption(nextValue);
        }
      }
    }

    const save = page.getByRole("button", { name: "Save adjustment" });
    if (await save.isEnabled()) {
      await save.click();
      await expect(page.getByText(/saved/i)).toBeVisible();
    }

    await page.getByRole("button", { name: "Confirm draw" }).click();
    await page.getByRole("button", { name: "Confirm & lock" }).click();
    await expect(page.getByText(/confirmed and locked/i)).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await expect(page.getByText(/LOCKED|Locked draw/i).first()).toBeVisible();
  });
});
