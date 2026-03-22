/**
 * E2E Test: Onboarding — Tour & Forecast
 *
 * Tests the onboarding beacon system for the Profit Forecast page and the
 * Tour Reset functionality. The onboarding uses `@repere/react` to render
 * "beacon" triggers (pulsing info icons) next to UI elements. Each beacon
 * has a popover with content and a "Got it" acknowledge button.
 *
 * Flow:
 *   1. Profit Forecast page — verify 5 page-specific beacons, acknowledge each.
 *   2. Tour Reset — navigate to Settings, click "Reset Tour", verify beacons
 *      reappear on the home page.
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

/** Beacons visible on the Current Session page (global + page-specific). */
const CURRENT_SESSION_BEACONS = [
  "game-selector",
  "overlay-icon",
  "current-session-rarity-source",
  "current-session-pricing",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Waits for all beacon triggers to finish rendering on the current page.
 *
 * The `@repere/react` library renders `<button>` elements with a
 * `data-repere-trigger` attribute after a configured `delay: 500` ms.
 * We wait for the expected number of triggers to appear in the DOM.
 *
 * @param page - Playwright Page
 * @param expectedCount - Minimum number of triggers expected on the page
 */
async function waitForTriggers(page: Page, expectedCount: number) {
  const triggers = page.locator("[data-repere-trigger]");

  // Wait until the expected number of triggers appear
  await expect(triggers).toHaveCount(expectedCount, {
    timeout: TRIGGER_RENDER_TIMEOUT,
  });
}

/**
 * Asserts that a popover opened and is visible.
 *
 * The library pre-renders ALL popover `<div>`s in the DOM (hidden via the
 * native `popover` attribute). Only the active one gets the `:popover-open`
 * pseudo-class, so we use that to target the single visible popover.
 */
async function expectPopoverVisible(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  await expect(openPopover).toBeVisible({ timeout: 5_000 });
}

/**
 * Clicks the "Got it" acknowledge button inside the currently open popover.
 * After clicking, the trigger for this beacon should disappear.
 */
async function acknowledgeBeacon(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  const gotIt = openPopover.getByText("Got it");
  await expect(gotIt).toBeVisible({ timeout: 5_000 });

  // The "Got it" button's click handler dismisses the beacon and calls
  // `hidePopover()` on the native popover element.  This can detach the
  // element mid-interaction, causing Playwright's auto-retry to fail with
  // "element was detached from the DOM".
  //
  // Workaround: attempt the trusted click.  If it throws due to the DOM
  // detach race we know the click *did* fire, so we swallow the error.
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

  // Brief settle for the repere library to update its internal state
  // (remove the trigger from the DOM, persist dismissal to the store).
  await page.waitForTimeout(300);
}

/**
 * Full lifecycle for a single beacon: open popover → verify → acknowledge.
 *
 * After each acknowledge the remaining trigger count decreases, so this
 * always clicks the **first** trigger in the list (index 0) since the
 * previously-acknowledged trigger will have been removed from the DOM.
 *
 * @param page - Playwright Page
 */
async function acknowledgeFirstBeacon(page: Page) {
  // The first visible trigger (previously acknowledged ones are removed)
  const trigger = page.locator("[data-repere-trigger]").first();
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
  await trigger.evaluate((el: HTMLElement) => el.click());

  await expectPopoverVisible(page);
  await acknowledgeBeacon(page);
}

/**
 * Acknowledges all currently visible beacon triggers on the page, one by one.
 * Always clicks the first available trigger since dismissed ones disappear.
 *
 * @param page - Playwright Page
 * @param count - Number of beacons to acknowledge
 */
async function acknowledgeAllBeacons(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await acknowledgeFirstBeacon(page);
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Onboarding — Tour & Forecast", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    // Seed data so pages that depend on league/snapshot data render correctly
    await seedSessionPrerequisites(page);
  });

  // ── Profit Forecast Page ────────────────────────────────────────────────

  test.describe("Profit Forecast Page Beacons", () => {
    test("should show only page-specific beacons when globals are already dismissed", async ({
      page,
    }) => {
      // Pre-dismiss global + previous page beacons
      await setSetting(page, "onboardingDismissedBeacons", [
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
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/profit-forecast");
      await waitForRoute(page, "/profit-forecast", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Only the 5 profit-forecast-specific beacons should be visible
      await waitForTriggers(page, PROFIT_FORECAST_BEACONS.length);

      const count = await page.locator("[data-repere-trigger]").count();
      expect(count).toBe(PROFIT_FORECAST_BEACONS.length);
    });

    test("should acknowledge all profit forecast beacons", async ({ page }) => {
      // Pre-dismiss global + previous page beacons
      await setSetting(page, "onboardingDismissedBeacons", [
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
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/profit-forecast");
      await waitForRoute(page, "/profit-forecast", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, PROFIT_FORECAST_BEACONS.length);

      // Acknowledge each beacon
      for (let i = 0; i < PROFIT_FORECAST_BEACONS.length; i++) {
        const trigger = page.locator("[data-repere-trigger]").first();
        await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
        await trigger.evaluate((el: HTMLElement) => el.click());

        await expectPopoverVisible(page);
        await acknowledgeBeacon(page);
      }

      // All triggers should be gone
      const remaining = await page.locator("[data-repere-trigger]").count();
      expect(remaining).toBe(0);
    });

    test("should open and verify popover content for each beacon", async ({
      page,
    }) => {
      await setSetting(page, "onboardingDismissedBeacons", [
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
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/profit-forecast");
      await waitForRoute(page, "/profit-forecast", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, PROFIT_FORECAST_BEACONS.length);

      for (let i = 0; i < PROFIT_FORECAST_BEACONS.length; i++) {
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
        // The native popover API can detach the element mid-click.
        // Swallow the detach error — the click still fires.
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

        // Brief settle for the repere library to update its internal state
        await page.waitForTimeout(300);
      }
    });

    test("should persist all dismissed beacons to Electron settings after acknowledging", async ({
      page,
    }) => {
      await setSetting(page, "onboardingDismissedBeacons", [
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
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/profit-forecast");
      await waitForRoute(page, "/profit-forecast", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, PROFIT_FORECAST_BEACONS.length);
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

  // ── Tour Reset ──────────────────────────────────────────────────────────

  test.describe("Tour Reset", () => {
    test("should reset all beacons via the Settings page Reset Tour button", async ({
      page,
    }) => {
      // Start with all beacons dismissed
      const allBeaconIds = [
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
        "pf-pl-card-only",
        "pf-pl-all-drops",
        "pf-break-even-rate",
        "pf-cost-model",
        "pf-base-rate",
      ];

      await setSetting(page, "onboardingDismissedBeacons", allBeaconIds);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      // Verify no beacons on home page (all dismissed)
      await navigateTo(page, "/");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      const beforeCount = await page.locator("[data-repere-trigger]").count();
      expect(beforeCount).toBe(0);

      // Navigate to Settings
      await navigateTo(page, "/settings");
      await waitForRoute(page, "/settings", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Find and click the Reset Tour button
      const resetTourButton = page
        .locator("button[data-onboarding='onboarding-button']")
        .first();
      await expect(resetTourButton).toBeVisible({ timeout: 10_000 });
      await expect(resetTourButton).toBeEnabled();

      // Clicking "Reset Tour" calls resetAll() then window.location.reload().
      // We need to handle the page reload.
      await resetTourButton.click();

      // Wait for the reload to complete
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

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
      // Start with all beacons dismissed
      const allBeaconIds = [
        "game-selector",
        "overlay-icon",
        "current-session-rarity-source",
        "stash-prices",
        "start-session",
      ];

      await setSetting(page, "onboardingDismissedBeacons", allBeaconIds);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      // Navigate to Settings and click Reset Tour
      await navigateTo(page, "/settings");
      await waitForRoute(page, "/settings", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      const resetTourButton = page
        .locator("button[data-onboarding='onboarding-button']")
        .first();
      await expect(resetTourButton).toBeVisible({ timeout: 10_000 });
      await resetTourButton.click();

      // Wait for reload
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

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
      await setSetting(page, "onboardingDismissedBeacons", [
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
        "pf-pl-card-only",
        "pf-pl-all-drops",
        "pf-break-even-rate",
        "pf-cost-model",
        "pf-base-rate",
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      // Navigate to Settings and click Reset Tour
      await navigateTo(page, "/settings");
      await waitForRoute(page, "/settings", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      const resetTourButton = page
        .locator("button[data-onboarding='onboarding-button']")
        .first();
      await expect(resetTourButton).toBeVisible({ timeout: 10_000 });
      await resetTourButton.click();

      // Wait for reload
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      // Check home page: 2 global + 3 page-specific = 5
      await navigateTo(page, "/");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
      await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);
      expect(await page.locator("[data-repere-trigger]").count()).toBe(
        CURRENT_SESSION_BEACONS.length,
      );

      // Check rarity insights page: 2 global + 5 page-specific = 7
      await navigateTo(page, "/rarity-insights");
      await waitForRoute(page, "/rarity-insights", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      const expectedRiCount = 2 + RARITY_INSIGHTS_BEACONS.length;
      await waitForTriggers(page, expectedRiCount);
      const riCount = await page.locator("[data-repere-trigger]").count();
      expect(riCount).toBe(expectedRiCount);

      // Check profit forecast page: 2 global + 5 page-specific = 7
      await navigateTo(page, "/profit-forecast");
      await waitForRoute(page, "/profit-forecast", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      const expectedPfCount = 2 + PROFIT_FORECAST_BEACONS.length;
      await waitForTriggers(page, expectedPfCount);
      const pfCount = await page.locator("[data-repere-trigger]").count();
      expect(pfCount).toBe(expectedPfCount);
    });
  });
});
