/**
 * E2E Test: Onboarding - Current Session Page Beacons
 *
 * Tests the onboarding beacon system for the Current Session page.
 * The onboarding uses `@repere/react` to render "beacon" triggers (pulsing
 * info icons) next to UI elements. Each beacon has a popover with content
 * and a "Got it" acknowledge button. Beacons are organized by page and
 * dismissed state is persisted to Electron settings via
 * `onboardingDismissedBeacons`.
 *
 * Flow:
 *   1. Current Session page - verify all 5 beacons (2 global + 3 page-specific),
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

const TRIGGER_RENDER_TIMEOUT = 5_000;

const CURRENT_SESSION_BEACONS = [
  "game-selector",
  "overlay-icon",
  "current-session-rarity-source",
  "stash-prices",
  "start-session",
] as const;

async function clickTrigger(page: Page, index: number) {
  const trigger = page.locator("[data-repere-trigger]").nth(index);
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });
  await trigger.evaluate((el: HTMLElement) => el.click());
}

async function testCloseReopenAndAcknowledge(
  page: Page,
  expectedRemainingTriggers?: number,
) {
  const trigger = page.locator("[data-repere-trigger]").first();
  await expect(trigger).toBeAttached({ timeout: TRIGGER_RENDER_TIMEOUT });

  await trigger.evaluate((el: HTMLElement) => el.click());
  await expectPopoverVisible(page);

  await page.keyboard.press("Escape");
  await expectPopoverHidden(page);

  await expect(trigger).toBeAttached({ timeout: 3_000 });

  await trigger.evaluate((el: HTMLElement) => el.click());
  await expectPopoverVisible(page);

  await acknowledgeBeacon(page, expectedRemainingTriggers);
}

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

test.describe("Onboarding - Current Session Beacons", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
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

    await clickTrigger(page, 0);
    await expectPopoverVisible(page);

    await page.keyboard.press("Escape");
    await expectPopoverHidden(page);

    const triggers = page.locator("[data-repere-trigger]");
    const count = await triggers.count();
    expect(count).toBe(CURRENT_SESSION_BEACONS.length);
  });

  test("should dismiss all beacons immediately from the popover", async ({
    page,
  }) => {
    await setupCurrentSessionBeacons(page);

    await clickTrigger(page, 0);
    await expectPopoverVisible(page);

    await page
      .locator("[data-repere-popover]:popover-open")
      .getByRole("button", { name: "Dismiss All" })
      .click();

    await expect(
      page.locator("[data-repere-popover]:popover-open"),
    ).toHaveCount(0, { timeout: 5_000 });
    await expect(page.locator("[data-repere-trigger]")).toHaveCount(0, {
      timeout: 5_000,
    });
  });

  test("should close via Escape, reopen, and acknowledge first beacon", async ({
    page,
  }) => {
    await setupCurrentSessionBeacons(page);

    const beforeCount = await page.locator("[data-repere-trigger]").count();

    await testCloseReopenAndAcknowledge(page, beforeCount - 1);

    const afterCount = await page.locator("[data-repere-trigger]").count();
    expect(afterCount).toBe(beforeCount - 1);
  });

  test("should acknowledge all beacons on the current session page", async ({
    page,
  }) => {
    await setupCurrentSessionBeacons(page);

    await acknowledgeAllBeacons(page, CURRENT_SESSION_BEACONS.length);

    const remaining = await page.locator("[data-repere-trigger]").count();
    expect(remaining).toBe(0);

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
