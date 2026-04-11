/**
 * E2E Test: Onboarding — Tour Reset
 *
 * Tests the Tour Reset functionality accessible from the Settings page.
 * Verifies that clicking "Reset Tour" clears all dismissed beacons and
 * makes them reappear on all pages.
 *
 * Split from `onboarding-tour.e2e.test.ts` for better parallelism.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required
 *
 * @module e2e/flows/onboarding/tour-reset
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../../helpers/electron-test";
import { setSetting } from "../../helpers/ipc-helpers";
import {
  ensurePostSetup,
  navigateTo,
  switchToTableView,
  waitForHydration,
  waitForRoute,
} from "../../helpers/navigation";
import {
  resetLeagueToFixture,
  seedSessionPrerequisites,
} from "../../helpers/seed-db";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long to wait for triggers to render (library uses delay: 500ms). */
const TRIGGER_RENDER_TIMEOUT = 5_000;

/** Beacons visible on the Current Session page (global + page-specific). */
const CURRENT_SESSION_BEACONS = [
  "game-selector",
  "overlay-icon",
  "current-session-rarity-source",
  "stash-prices",
  "start-session",
] as const;

/** Beacons specific to the Rarity Insights page. */
const RARITY_INSIGHTS_BEACONS = [
  "rarity-insights-poe-ninja",
  "rarity-insights-prohibited-library",
  "rarity-insights-refresh",
  "rarity-insights-scan",
  "rarity-insights-toolbar",
] as const;

/** Beacons specific to the Profit Forecast page. */
const PROFIT_FORECAST_BEACONS = [
  "pf-pl-card-only",
  "pf-pl-all-drops",
  "pf-break-even-rate",
  "pf-cost-model",
  "pf-base-rate",
] as const;

/** All beacon IDs across all pages. */
const ALL_BEACON_IDS = [
  ...CURRENT_SESSION_BEACONS,
  ...RARITY_INSIGHTS_BEACONS,
  ...PROFIT_FORECAST_BEACONS,
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Waits for all beacon triggers to finish rendering on the current page.
 */
async function waitForTriggers(page: Page, expectedCount: number) {
  const triggers = page.locator("[data-repere-trigger]");
  await expect(triggers).toHaveCount(expectedCount, {
    timeout: TRIGGER_RENDER_TIMEOUT,
  });
}

/**
 * Navigates to Settings, clicks "Reset Tour", and waits for the reload to
 * complete. Shared across all tour reset tests to avoid duplication.
 */
async function performTourReset(page: Page) {
  await navigateTo(page, "/settings");
  await waitForRoute(page, "/settings", 10_000);
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

  const resetTourButton = page
    .locator("button[data-onboarding='onboarding-button']")
    .first();
  await expect(resetTourButton).toBeVisible({ timeout: 10_000 });
  await expect(resetTourButton).toBeEnabled();

  // Clicking "Reset Tour" calls resetAll() then window.location.reload().
  await resetTourButton.click();

  // Wait for the reload to complete
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
  await waitForHydration(page, 30_000);
  await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Onboarding — Tour Reset", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await resetLeagueToFixture(page, "Standard");
    await seedSessionPrerequisites(page);
  });

  test("should reset all beacons via the Settings page Reset Tour button", async ({
    page,
  }) => {
    // Start with all beacons dismissed
    await setSetting(page, "onboardingDismissedBeacons", [...ALL_BEACON_IDS]);
    await page.reload();
    await waitForHydration(page, 30_000);
    await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

    // Verify no beacons on home page (all dismissed)
    await navigateTo(page, "/");
    await waitForRoute(page, "/", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

    const beforeCount = await page.locator("[data-repere-trigger]").count();
    expect(beforeCount).toBe(0);

    // Perform the reset
    await performTourReset(page);

    // Navigate back to the home page
    await navigateTo(page, "/");
    await waitForRoute(page, "/", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

    // Beacons should be visible again!
    await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);

    const afterCount = await page.locator("[data-repere-trigger]").count();
    expect(afterCount).toBe(CURRENT_SESSION_BEACONS.length);
  });

  test("should clear the persisted dismissed list after reset", async ({
    page,
  }) => {
    // Start with some beacons dismissed
    await setSetting(page, "onboardingDismissedBeacons", [
      ...CURRENT_SESSION_BEACONS,
    ]);
    await page.reload();
    await waitForHydration(page, 30_000);
    await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

    // Perform the reset
    await performTourReset(page);

    // Verify the persisted setting is now empty
    const dismissed = await page.evaluate(() => {
      return (window as any).electron.settings.get(
        "onboardingDismissedBeacons",
      );
    });

    expect(Array.isArray(dismissed)).toBe(true);
    expect((dismissed as string[]).length).toBe(0);
  });

  test("should show beacons on all pages after reset", async ({ page }) => {
    // Start with all beacons dismissed
    await setSetting(page, "onboardingDismissedBeacons", [...ALL_BEACON_IDS]);
    await page.reload();
    await waitForHydration(page, 30_000);
    await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

    // Perform the reset
    await performTourReset(page);

    // Check home page: 2 global + 3 page-specific = 5
    await navigateTo(page, "/");
    await waitForRoute(page, "/", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
    await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);
    await expect(page.locator("[data-repere-trigger]")).toHaveCount(
      CURRENT_SESSION_BEACONS.length,
      { timeout: 5_000 },
    );

    // Check rarity insights page: 2 global + 3 always-visible RI = 5 minimum.
    // If card data is loaded the table column beacons (poe-ninja,
    // prohibited-library) add 2 more (total 7).
    await navigateTo(page, "/rarity-insights");
    await waitForRoute(page, "/rarity-insights", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

    const minExpectedRiCount = 2 + 3; // 2 global + 3 always-visible RI
    const maxExpectedRiCount = 2 + RARITY_INSIGHTS_BEACONS.length;
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: TRIGGER_RENDER_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(minExpectedRiCount);

    const riCount = await page.locator("[data-repere-trigger]").count();
    expect(riCount).toBeGreaterThanOrEqual(minExpectedRiCount);
    expect(riCount).toBeLessThanOrEqual(maxExpectedRiCount);

    // Check profit forecast page: 2 global + 3 always-visible = 5 minimum.
    // If PL data is loaded the table column beacons add 2 more (total 7).
    await navigateTo(page, "/profit-forecast");
    await waitForRoute(page, "/profit-forecast", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

    // Switch to table view so P&L column header beacons can appear (if data exists)
    await switchToTableView(page);

    const minExpectedPfCount = 2 + 3; // 2 global + 3 always-visible
    const maxExpectedPfCount = 2 + PROFIT_FORECAST_BEACONS.length;

    // Wait for the trigger count to settle within the expected range.
    // We can't use waitForTriggers (exact match) because the count is
    // either 5 (no PL table data) or 7 (PL data loaded → table column
    // beacons appear) depending on seed state.
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: TRIGGER_RENDER_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(minExpectedPfCount);

    const pfCount = await page.locator("[data-repere-trigger]").count();
    expect(pfCount).toBeGreaterThanOrEqual(minExpectedPfCount);
    expect(pfCount).toBeLessThanOrEqual(maxExpectedPfCount);
  });
});
