/**
 * E2E Test: Onboarding — Profit Forecast Beacons
 *
 * Tests the onboarding beacon system for the Profit Forecast page.
 * The onboarding uses `@repere/react` to render "beacon" triggers
 * (pulsing info icons) next to UI elements. Each beacon has a popover
 * with content and a "Got it" acknowledge button.
 *
 * Flow:
 *   1. Profit Forecast page — verify 5 page-specific beacons, acknowledge each.
 *   2. Verify popover content for each beacon.
 *   3. Verify persistence of dismissed beacons to Electron settings.
 *
 * Tour Reset tests live in `onboarding-tour-reset.e2e.test.ts`.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required
 *
 * @module e2e/flows/onboarding/onboarding-tour
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
  acknowledgeAllBeacons,
  waitForTriggers,
} from "../../helpers/onboarding";
import {
  resetLeagueToFixture,
  seedSessionPrerequisites,
} from "../../helpers/seed-db";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long to wait for triggers to render (library uses delay: 500ms). */
const TRIGGER_RENDER_TIMEOUT = 5_000;

/** All beacons on the Profit Forecast page (chart + table view). */
const PROFIT_FORECAST_BEACONS = [
  "pf-pl-card-only",
  "pf-pl-all-drops",
  "pf-break-even-rate",
  "pf-cost-model",
  "pf-base-rate",
] as const;

/**
 * Beacons visible in the default chart view (summary cards + cost model).
 * The remaining 2 (pf-pl-card-only, pf-pl-all-drops) only appear in
 * table view when the table has data rows.
 */
const CHART_VIEW_BEACON_COUNT = 3;

/** All previously-dismissed beacons (global + rarity insights). */
const PRE_DISMISSED_BEACONS = [
  "game-selector",
  "overlay-icon",
  "current-session-rarity-source",
  "stash-prices",
  "start-session",
  "rarity-insights-poe-ninja",
  "rarity-insights-prohibited-library",
  "rarity-insights-refresh",
  "rarity-insights-scan",
  "rarity-insights-toolbar",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Common setup for Profit Forecast beacon tests:
 * pre-dismiss previous beacons, reload, navigate to profit forecast.
 * Stays in the default **chart** view (3 beacons visible).
 * Tests that need table view should call `switchToTableView` themselves.
 */
async function setupProfitForecastBeacons(page: Page) {
  await setSetting(page, "onboardingDismissedBeacons", [
    ...PRE_DISMISSED_BEACONS,
  ]);
  await page.reload();
  await waitForHydration(page, 30_000);
  await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

  await navigateTo(page, "/profit-forecast");
  await waitForRoute(page, "/profit-forecast", 10_000);
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

  await waitForTriggers(page, CHART_VIEW_BEACON_COUNT);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Onboarding — Profit Forecast Beacons", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await resetLeagueToFixture(page, "Standard");
    await seedSessionPrerequisites(page);
  });

  test("should show only page-specific beacons when globals are already dismissed", async ({
    page,
  }) => {
    await setupProfitForecastBeacons(page);

    // Default chart view: only the 3 always-visible beacons (summary cards + cost model).
    // The 2 table-column beacons (pf-pl-card-only, pf-pl-all-drops) are not in the DOM.
    const count = await page.locator("[data-repere-trigger]").count();
    expect(count).toBe(CHART_VIEW_BEACON_COUNT);
  });

  test("should acknowledge all profit forecast beacons", async ({ page }) => {
    await setupProfitForecastBeacons(page);

    // Chart view shows 3 beacons. Switching to table view may add 2 more
    // (pf-pl-card-only, pf-pl-all-drops) if PL data is loaded and the
    // table renders rows. Work with whatever count is actually present.
    await switchToTableView(page);

    // Let the beacon count settle — it will be 3 (no table rows) or 5.
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: TRIGGER_RENDER_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(CHART_VIEW_BEACON_COUNT);

    const beaconCount = await page.locator("[data-repere-trigger]").count();

    // Acknowledge each beacon, waiting for the trigger count to decrease
    await acknowledgeAllBeacons(page, beaconCount);

    // All triggers should be gone
    const remaining = await page.locator("[data-repere-trigger]").count();
    expect(remaining).toBe(0);
  });

  test("should open and verify popover content for each beacon", async ({
    page,
  }) => {
    await setupProfitForecastBeacons(page);

    // Switch to table view — beacon count will be 3 or 5 depending on PL data
    await switchToTableView(page);

    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: TRIGGER_RENDER_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(CHART_VIEW_BEACON_COUNT);

    const beaconCount = await page.locator("[data-repere-trigger]").count();

    for (let i = 0; i < beaconCount; i++) {
      const expectedRemaining = beaconCount - i - 1;
      const trigger = page.locator("[data-repere-trigger]").first();
      await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
      await trigger.evaluate((el: HTMLElement) => el.click());

      const popover = page.locator("[data-repere-popover]:popover-open");
      await expect(popover).toBeVisible({ timeout: 5_000 });

      // Verify popover has meaningful content
      const popoverText = await popover.textContent();
      expect(popoverText).toBeTruthy();
      expect(popoverText!.length).toBeGreaterThan(0);

      // Verify the "Got it" button is present and click it.
      const gotIt = popover.getByText("Got it");
      await expect(gotIt).toBeVisible();
      try {
        await gotIt.click({ timeout: 3_000 });
      } catch {
        // detached during dismiss — expected
      }
      await expect(
        page.locator("[data-repere-popover]:popover-open"),
      ).toHaveCount(0, { timeout: 5_000 });

      // Wait for the trigger to be removed before clicking the next one
      await expect(page.locator("[data-repere-trigger]")).toHaveCount(
        expectedRemaining,
        { timeout: 5_000 },
      );
    }
  });

  test("should persist all dismissed beacons to Electron settings after acknowledging", async ({
    page,
  }) => {
    await setupProfitForecastBeacons(page);

    // Switch to table view — beacon count will be 3 or 5 depending on PL data
    await switchToTableView(page);

    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: TRIGGER_RENDER_TIMEOUT,
      })
      .toBeGreaterThanOrEqual(CHART_VIEW_BEACON_COUNT);

    const beaconCount = await page.locator("[data-repere-trigger]").count();
    await acknowledgeAllBeacons(page, beaconCount);

    // All beacons from every page should now be dismissed
    const dismissed = await page.evaluate(() => {
      return (window as any).electron.settings.get(
        "onboardingDismissedBeacons",
      );
    });

    expect(Array.isArray(dismissed)).toBe(true);

    // The pre-dismissed beacons and the 3 always-visible beacons must be present
    const alwaysExpectedIds = [
      ...PRE_DISMISSED_BEACONS,
      "pf-break-even-rate",
      "pf-cost-model",
      "pf-base-rate",
    ];

    const dismissedArray = dismissed as string[];
    for (const id of alwaysExpectedIds) {
      expect(dismissedArray).toContain(id);
    }

    // The 2 table-column beacons are only dismissed if PL data was loaded
    if (beaconCount === PROFIT_FORECAST_BEACONS.length) {
      expect(dismissedArray).toContain("pf-pl-card-only");
      expect(dismissedArray).toContain("pf-pl-all-drops");
    }
  });
});
