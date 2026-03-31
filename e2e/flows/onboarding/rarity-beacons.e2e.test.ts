/**
 * E2E Test: Onboarding — Rarity Insights Page Beacons
 *
 * Tests the onboarding beacon system for the Rarity Insights page.
 * Split from onboarding-beacons.e2e.test.ts for better parallelism.
 *
 * The onboarding uses `@repere/react` to render "beacon" triggers (pulsing
 * info icons) next to UI elements. Each beacon has a popover with content
 * and a "Got it" acknowledge button.
 *
 * Flow:
 *   1. Pre-dismiss global beacons so only page-specific ones are visible.
 *   2. Verify 5 rarity-insights-specific beacons appear.
 *   3. Acknowledge each beacon and verify popover content.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required
 *
 * @module e2e/flows/onboarding/rarity-beacons
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

/** Beacons specific to the Rarity Insights page. */
const RARITY_INSIGHTS_BEACONS = [
  "rarity-insights-poe-ninja",
  "rarity-insights-prohibited-library",
  "rarity-insights-refresh",
  "rarity-insights-scan",
  "rarity-insights-toolbar",
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForTriggers(page: Page, expectedCount: number) {
  const triggers = page.locator("[data-repere-trigger]");
  await expect(triggers).toHaveCount(expectedCount, {
    timeout: TRIGGER_RENDER_TIMEOUT,
  });
}

async function expectPopoverVisible(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  await expect(openPopover).toBeVisible({ timeout: 5_000 });
}

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

  // If the click didn't register (CI timing), force-hide via JS.
  const stillOpen = await page
    .locator("[data-repere-popover]:popover-open")
    .count();
  if (stillOpen > 0) {
    await page.evaluate(() => {
      const open = document.querySelector(
        "[data-repere-popover]:popover-open",
      ) as HTMLElement | null;
      if (open && typeof open.hidePopover === "function") {
        open.hidePopover();
      }
    });
  }

  await expect(page.locator("[data-repere-popover]:popover-open")).toHaveCount(
    0,
    { timeout: 5_000 },
  );

  // Wait for the trigger to actually be removed from the DOM (replaces hard 300ms sleep).
  // The repere library needs a moment to update its internal state and remove
  // the dismissed trigger element.
  if (expectedRemainingTriggers !== undefined) {
    await expect(page.locator("[data-repere-trigger]")).toHaveCount(
      expectedRemainingTriggers,
      { timeout: 5_000 },
    );
  }
}

/**
 * Navigates to rarity insights with dismissed globals and waits for page-specific beacons.
 */
async function setupRarityInsightsBeacons(page: Page) {
  await setSetting(page, "onboardingDismissedBeacons", [
    "game-selector",
    "overlay-icon",
  ]);
  await page.reload();
  await waitForHydration(page, 30_000);
  await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

  await navigateTo(page, "/rarity-insights");
  await waitForRoute(page, "/rarity-insights", 10_000);
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

  await waitForTriggers(page, RARITY_INSIGHTS_BEACONS.length);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Onboarding — Rarity Insights Page Beacons", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await seedSessionPrerequisites(page);
  });

  test("should show only page-specific beacons when globals are already dismissed", async ({
    page,
  }) => {
    await setupRarityInsightsBeacons(page);

    const count = await page.locator("[data-repere-trigger]").count();
    expect(count).toBe(RARITY_INSIGHTS_BEACONS.length);
  });

  test("should acknowledge all rarity insights beacons", async ({ page }) => {
    await setupRarityInsightsBeacons(page);

    // Acknowledge each beacon
    for (let i = 0; i < RARITY_INSIGHTS_BEACONS.length; i++) {
      const trigger = page.locator("[data-repere-trigger]").first();
      await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
      await trigger.evaluate((el: HTMLElement) => el.click());

      await expectPopoverVisible(page);
      await acknowledgeBeacon(page, RARITY_INSIGHTS_BEACONS.length - i - 1);
    }

    // All triggers should be gone
    const remaining = await page.locator("[data-repere-trigger]").count();
    expect(remaining).toBe(0);
  });

  test("should open and verify popover content for each beacon", async ({
    page,
  }) => {
    await setupRarityInsightsBeacons(page);

    for (let i = 0; i < RARITY_INSIGHTS_BEACONS.length; i++) {
      const expectedRemaining = RARITY_INSIGHTS_BEACONS.length - i - 1;
      const trigger = page.locator("[data-repere-trigger]").first();
      await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
      await trigger.evaluate((el: HTMLElement) => el.click());

      const popover = page.locator("[data-repere-popover]:popover-open");
      await expect(popover).toBeVisible({ timeout: 5_000 });

      // Verify popover has meaningful content
      const popoverText = await popover.textContent();
      expect(popoverText).toBeTruthy();
      expect(popoverText!.length).toBeGreaterThan(0);

      // Verify the "Got it" button is present
      const gotIt = popover.getByText("Got it");
      await expect(gotIt).toBeVisible();

      try {
        await gotIt.click({ timeout: 3_000 });
      } catch {
        // detached during dismiss — expected
      }

      // If the click didn't register (CI timing), force-hide via JS
      const stillOpen = await page
        .locator("[data-repere-popover]:popover-open")
        .count();
      if (stillOpen > 0) {
        await page.evaluate(() => {
          const open = document.querySelector(
            "[data-repere-popover]:popover-open",
          ) as HTMLElement | null;
          if (open && typeof open.hidePopover === "function") {
            open.hidePopover();
          }
        });
      }

      await expect(
        page.locator("[data-repere-popover]:popover-open"),
      ).toHaveCount(0, { timeout: 5_000 });

      // Wait for the trigger to be removed from the DOM before next iteration
      await expect(page.locator("[data-repere-trigger]")).toHaveCount(
        expectedRemaining,
        { timeout: 5_000 },
      );
    }
  });
});
