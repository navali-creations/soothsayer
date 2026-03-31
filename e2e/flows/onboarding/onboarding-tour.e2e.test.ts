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
  waitForHydration,
  waitForRoute,
} from "../../helpers/navigation";
import { seedSessionPrerequisites } from "../../helpers/seed-db";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How long to wait for triggers to render (library uses delay: 500ms). */
const TRIGGER_RENDER_TIMEOUT = 5_000;

/** Beacons specific to the Profit Forecast page. */
const PROFIT_FORECAST_BEACONS = [
  "pf-pl-card-only",
  "pf-pl-all-drops",
  "pf-break-even-rate",
  "pf-cost-model",
  "pf-base-rate",
] as const;

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
 * Waits for all beacon triggers to finish rendering on the current page.
 */
async function waitForTriggers(page: Page, expectedCount: number) {
  const triggers = page.locator("[data-repere-trigger]");
  await expect(triggers).toHaveCount(expectedCount, {
    timeout: TRIGGER_RENDER_TIMEOUT,
  });
}

/**
 * Asserts that a popover opened and is visible.
 */
async function expectPopoverVisible(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  await expect(openPopover).toBeVisible({ timeout: 5_000 });
}

/**
 * Clicks the "Got it" acknowledge button inside the currently open popover.
 * After clicking, the trigger for this beacon should disappear.
 *
 * @param page - Playwright Page
 * @param expectedRemainingTriggers - If provided, waits for the trigger count
 *   to reach this value after dismissal (replaces the old hard 300ms sleep).
 */
async function acknowledgeBeacon(
  page: Page,
  expectedRemainingTriggers?: number,
) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  const gotIt = openPopover.getByText("Got it");
  await expect(gotIt).toBeVisible({ timeout: 5_000 });

  try {
    await gotIt.click({ timeout: 3_000 });
  } catch {
    // Click fired but the element was detached before Playwright could
    // confirm — that's the expected behaviour for native popover dismiss.
  }

  // Wait for the popover to close after dismiss
  await expect(page.locator("[data-repere-popover]:popover-open")).toHaveCount(
    0,
    { timeout: 5_000 },
  );

  // Wait for the trigger to actually be removed from the DOM (replaces hard 300ms sleep)
  if (expectedRemainingTriggers !== undefined) {
    await expect(page.locator("[data-repere-trigger]")).toHaveCount(
      expectedRemainingTriggers,
      { timeout: 5_000 },
    );
  }
}

/**
 * Full lifecycle for a single beacon: open popover → verify → acknowledge.
 */
async function acknowledgeFirstBeacon(
  page: Page,
  expectedRemainingTriggers?: number,
) {
  const trigger = page.locator("[data-repere-trigger]").first();
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
  await trigger.evaluate((el: HTMLElement) => el.click());

  await expectPopoverVisible(page);
  await acknowledgeBeacon(page, expectedRemainingTriggers);
}

/**
 * Acknowledges all currently visible beacon triggers on the page, one by one.
 */
async function acknowledgeAllBeacons(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await acknowledgeFirstBeacon(page, count - i - 1);
  }
}

/**
 * Switches the Profit Forecast page from the default "chart" view to "table"
 * view by clicking the Table badge in the cost model panel.
 */
async function switchToTableView(page: Page) {
  const tableBadge = page.locator("button", { hasText: "Table" }).first();
  await expect(tableBadge).toBeVisible({ timeout: 5_000 });
  await tableBadge.click();
  // Wait for the table to render instead of a hard 500ms sleep
  await page
    .locator("table, [role='table']")
    .first()
    .waitFor({
      state: "visible",
      timeout: 5_000,
    })
    .catch(() => {
      // Table may use a different structure; fall back to a short settle
    });
}

/**
 * Common setup for all Profit Forecast beacon tests:
 * pre-dismiss previous beacons, reload, navigate to profit forecast, switch to table.
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

  await switchToTableView(page);
  await waitForTriggers(page, PROFIT_FORECAST_BEACONS.length);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Onboarding — Profit Forecast Beacons", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    // Seed data so pages that depend on league/snapshot data render correctly
    await seedSessionPrerequisites(page);
  });

  test("should show only page-specific beacons when globals are already dismissed", async ({
    page,
  }) => {
    await setupProfitForecastBeacons(page);

    const count = await page.locator("[data-repere-trigger]").count();
    expect(count).toBe(PROFIT_FORECAST_BEACONS.length);
  });

  test("should acknowledge all profit forecast beacons", async ({ page }) => {
    await setupProfitForecastBeacons(page);

    // Acknowledge each beacon, waiting for the trigger count to decrease
    await acknowledgeAllBeacons(page, PROFIT_FORECAST_BEACONS.length);

    // All triggers should be gone
    const remaining = await page.locator("[data-repere-trigger]").count();
    expect(remaining).toBe(0);
  });

  test("should open and verify popover content for each beacon", async ({
    page,
  }) => {
    await setupProfitForecastBeacons(page);

    for (let i = 0; i < PROFIT_FORECAST_BEACONS.length; i++) {
      const expectedRemaining = PROFIT_FORECAST_BEACONS.length - i - 1;
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
    await acknowledgeAllBeacons(page, PROFIT_FORECAST_BEACONS.length);

    // All beacons from every page should now be dismissed
    const dismissed = await page.evaluate(() => {
      return (window as any).electron.settings.get(
        "onboardingDismissedBeacons",
      );
    });

    expect(Array.isArray(dismissed)).toBe(true);

    // Should contain all beacon IDs we've dismissed so far
    const allExpectedIds = [
      ...PRE_DISMISSED_BEACONS,
      "pf-pl-card-only",
      "pf-pl-all-drops",
      "pf-break-even-rate",
      "pf-cost-model",
      "pf-base-rate",
    ];

    const dismissedArray = dismissed as string[];
    for (const id of allExpectedIds) {
      expect(dismissedArray).toContain(id);
    }
  });
});
