/**
 * E2E Test: Onboarding — Current Session Page Beacons
 *
 * Tests the onboarding beacon system for the Current Session page.
 * The onboarding uses `@repere/react` to render "beacon" triggers (pulsing
 * info icons) next to UI elements. Each beacon has a popover with content
 * and a "Got it" acknowledge button. Beacons are organized by page and
 * dismissed state is persisted to Electron settings via
 * `onboardingDismissedBeacons`.
 *
 * Flow:
 *   1. Current Session page — verify all 5 beacons (2 global + 3 page-specific),
 *      exercise close/reopen via Escape, then acknowledge each.
 *
 * Rarity Insights page beacon tests live in `onboarding-beacons-rarity.e2e.test.ts`.
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
import {
  acknowledgeAllBeacons,
  acknowledgeBeacon,
  expectPopoverHidden,
  expectPopoverVisible,
  waitForTriggers,
} from "../../helpers/onboarding";
import { seedSessionPrerequisites } from "../../helpers/seed-db";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Clicks a beacon trigger button by its index among all visible triggers.
 */
async function clickTrigger(page: Page, index: number) {
  const trigger = page.locator("[data-repere-trigger]").nth(index);
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
  await trigger.evaluate((el: HTMLElement) => el.click());
}

/**
 * Exercises the close-via-Escape and reopen flow on the first visible beacon
 * trigger, then acknowledges it.
 */
async function testCloseReopenAndAcknowledge(
  page: Page,
  expectedRemainingTriggers?: number,
) {
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
  await acknowledgeBeacon(page, expectedRemainingTriggers);
}

/**
 * Common per-test setup: clear dismissed beacons, reload, hydrate, navigate
 * to the home page, and wait for triggers.
 */
async function setupCurrentSessionBeacons(page: Page) {
  await setSetting(page, "onboardingDismissedBeacons", []);
  await page.reload();
  await waitForHydration(page, 30_000);
  await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });

  await navigateTo(page, "/");
  await waitForRoute(page, "/", 10_000);
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

  await waitForTriggers(page, CURRENT_SESSION_BEACONS.length);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Onboarding — Current Session Beacons", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    // Seed data so pages that depend on league/snapshot data render correctly
    await seedSessionPrerequisites(page);
  });

  test("should show all beacon triggers on the home page", async ({ page }) => {
    await setupCurrentSessionBeacons(page);

    const triggers = page.locator("[data-repere-trigger]");
    const count = await triggers.count();
    expect(count).toBe(CURRENT_SESSION_BEACONS.length);
  });

  test("should open and close popover via Escape without acknowledging", async ({
    page,
  }) => {
    await setupCurrentSessionBeacons(page);

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
    await setupCurrentSessionBeacons(page);

    const beforeCount = await page.locator("[data-repere-trigger]").count();

    // Test close → reopen → acknowledge cycle
    await testCloseReopenAndAcknowledge(page, beforeCount - 1);

    // One fewer trigger after acknowledgement
    const afterCount = await page.locator("[data-repere-trigger]").count();
    expect(afterCount).toBe(beforeCount - 1);
  });

  test("should acknowledge all beacons on the current session page", async ({
    page,
  }) => {
    await setupCurrentSessionBeacons(page);

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
