/**
 * E2E Test: Onboarding — Page Beacons
 *
 * Tests the onboarding beacon system for the Current Session and Rarity
 * Insights pages. The onboarding uses `@repere/react` to render "beacon"
 * triggers (pulsing info icons) next to UI elements. Each beacon has a
 * popover with content and a "Got it" acknowledge button. Beacons are
 * organized by page and dismissed state is persisted to Electron settings
 * via `onboardingDismissedBeacons`.
 *
 * Flow:
 *   1. Current Session page — verify all 5 beacons (2 global + 3 page-specific),
 *      exercise close/reopen via Escape, then acknowledge each.
 *   2. Rarity Insights page — verify 5 page-specific beacons (globals already
 *      dismissed), acknowledge each.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required
 *
 * @module e2e/flows/onboarding/onboarding-beacons
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
 * Clicks a beacon trigger button by its index among all visible triggers.
 *
 * @param page - Playwright Page
 * @param index - Zero-based index of the trigger
 */
async function clickTrigger(page: Page, index: number) {
  const trigger = page.locator("[data-repere-trigger]").nth(index);
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
  // Triggers use fixed positioning and may be placed outside the viewport
  // bounds by the anchor-point tracker.  Playwright's click() fails for
  // elements outside the viewport even with force:true.
  //
  // The trigger uses the native `popovertarget` attribute, so we need a
  // trusted click.  `element.click()` in JS dispatches a trusted click
  // that activates the popover target behaviour.
  await trigger.evaluate((el: HTMLElement) => el.click());
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
 * Asserts that no popover is currently open.
 */
async function expectPopoverHidden(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  await expect(openPopover).toHaveCount(0, { timeout: 5_000 });
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
 * Exercises the close-via-Escape and reopen flow on the first visible beacon
 * trigger. This is used once on the first page to validate popover dismissal
 * without acknowledgement.
 *
 * Steps:
 *   1. Click the trigger → popover opens
 *   2. Press Escape → popover closes
 *   3. Verify the trigger is still visible (not acknowledged)
 *   4. Click the trigger again → popover reopens
 *   5. Acknowledge with "Got it"
 */
async function testCloseReopenAndAcknowledge(page: Page) {
  const trigger = page.locator("[data-repere-trigger]").first();
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });

  // Step 1: Open the popover
  await trigger.evaluate((el: HTMLElement) => el.click());
  await expectPopoverVisible(page);

  // Step 2: Close via Escape
  await page.keyboard.press("Escape");
  await expectPopoverHidden(page);

  // Step 3: Trigger should still be present (not acknowledged)
  await expect(trigger).toBeAttached({ timeout: 3_000 });

  // Step 4: Reopen
  await trigger.evaluate((el: HTMLElement) => el.click());
  await expectPopoverVisible(page);

  // Step 5: Acknowledge
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

test.describe("Onboarding — Page Beacons", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    // Seed data so pages that depend on league/snapshot data render correctly
    await seedSessionPrerequisites(page);
  });

  // ── Current Session Page ────────────────────────────────────────────────

  test.describe("Current Session Page Beacons", () => {
    test("should show all beacon triggers on the home page", async ({
      page,
    }) => {
      // Clear any previously dismissed beacons so we start fresh
      await setSetting(page, "onboardingDismissedBeacons", []);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Current session page shows 2 global beacons + 3 page-specific = 5 total
      await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);

      const triggers = page.locator("[data-repere-trigger]");
      const count = await triggers.count();
      expect(count).toBe(CURRENT_SESSION_BEACONS.length);
    });

    test("should open and close popover via Escape without acknowledging", async ({
      page,
    }) => {
      await setSetting(page, "onboardingDismissedBeacons", []);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);

      // Open the first trigger
      await clickTrigger(page, 0);
      await expectPopoverVisible(page);

      // Close via Escape
      await page.keyboard.press("Escape");
      await expectPopoverHidden(page);

      // The trigger should still be there (not acknowledged)
      const triggers = page.locator("[data-repere-trigger]");
      const count = await triggers.count();
      expect(count).toBe(CURRENT_SESSION_BEACONS.length);
    });

    test("should close via Escape, reopen, and acknowledge first beacon", async ({
      page,
    }) => {
      await setSetting(page, "onboardingDismissedBeacons", []);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);

      const beforeCount = await page.locator("[data-repere-trigger]").count();

      // Test close → reopen → acknowledge cycle
      await testCloseReopenAndAcknowledge(page);

      // One fewer trigger after acknowledgement
      const afterCount = await page.locator("[data-repere-trigger]").count();
      expect(afterCount).toBe(beforeCount - 1);
    });

    test("should acknowledge all beacons on the current session page", async ({
      page,
    }) => {
      await setSetting(page, "onboardingDismissedBeacons", []);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);

      // Acknowledge each beacon one by one
      await acknowledgeAllBeacons(page, CURRENT_SESSION_BEACONS.length);

      // All triggers should be gone
      const remaining = await page.locator("[data-repere-trigger]").count();
      expect(remaining).toBe(0);

      // Verify dismissed beacons are persisted via IPC
      const dismissed = await page.evaluate(() => {
        return (window as any).electron.settings.get(
          "onboardingDismissedBeacons",
        );
      });

      expect(Array.isArray(dismissed)).toBe(true);
      expect((dismissed as string[]).length).toBeGreaterThanOrEqual(
        CURRENT_SESSION_BEACONS.length,
      );
    });
  });

  // ── Rarity Insights Page ────────────────────────────────────────────────

  test.describe("Rarity Insights Page Beacons", () => {
    test("should show only page-specific beacons when globals are already dismissed", async ({
      page,
    }) => {
      // Pre-dismiss the global beacons (simulating previous page visit)
      await setSetting(page, "onboardingDismissedBeacons", [
        "game-selector",
        "overlay-icon",
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/rarity-insights");
      await waitForRoute(page, "/rarity-insights", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Only the 5 rarity-insights-specific beacons should be visible
      await waitForTriggers(page, RARITY_INSIGHTS_BEACONS.length);

      const count = await page.locator("[data-repere-trigger]").count();
      expect(count).toBe(RARITY_INSIGHTS_BEACONS.length);
    });

    test("should acknowledge all rarity insights beacons", async ({ page }) => {
      // Pre-dismiss the global beacons
      await setSetting(page, "onboardingDismissedBeacons", [
        "game-selector",
        "overlay-icon",
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/rarity-insights");
      await waitForRoute(page, "/rarity-insights", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, RARITY_INSIGHTS_BEACONS.length);

      // Acknowledge each beacon
      for (let i = 0; i < RARITY_INSIGHTS_BEACONS.length; i++) {
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
      ]);
      await page.reload();
      await waitForHydration(page, 30_000);
      await page
        .locator("aside")
        .waitFor({ state: "visible", timeout: 15_000 });

      await navigateTo(page, "/rarity-insights");
      await waitForRoute(page, "/rarity-insights", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      await waitForTriggers(page, RARITY_INSIGHTS_BEACONS.length);

      // For each beacon, click trigger → verify popover has content → acknowledge
      for (let i = 0; i < RARITY_INSIGHTS_BEACONS.length; i++) {
        const trigger = page.locator("[data-repere-trigger]").first();
        await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
        await trigger.evaluate((el: HTMLElement) => el.click());

        const popover = page.locator("[data-repere-popover]:popover-open");
        await expect(popover).toBeVisible({ timeout: 5_000 });

        // Verify popover has meaningful content (not empty)
        const popoverText = await popover.textContent();
        expect(popoverText).toBeTruthy();
        expect(popoverText!.length).toBeGreaterThan(0);

        // Verify the "Got it" button is present
        const gotIt = popover.getByText("Got it");
        await expect(gotIt).toBeVisible();

        // The native popover API can detach the element mid-click.
        // Swallow the detach error — the click still fires.
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
  });
});
