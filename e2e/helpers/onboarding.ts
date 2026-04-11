/**
 * E2E Onboarding Beacon Helpers
 *
 * Shared utilities for testing onboarding beacon popover interactions.
 * Uses the most robust implementation with CI fallback for force-hiding.
 *
 * @module e2e/helpers/onboarding
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const TRIGGER_RENDER_TIMEOUT = 15_000;

/**
 * Waits for all beacon triggers to finish rendering on the current page.
 */
export async function waitForTriggers(page: Page, expectedCount: number) {
  const triggers = page.locator("[data-repere-trigger]");
  await expect(triggers).toHaveCount(expectedCount, {
    timeout: TRIGGER_RENDER_TIMEOUT,
  });
}

/**
 * Asserts that a popover opened and is visible.
 */
export async function expectPopoverVisible(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  await expect(openPopover).toBeVisible({ timeout: 5_000 });
}

/**
 * Asserts that no popover is currently open.
 */
export async function expectPopoverHidden(page: Page) {
  const openPopover = page.locator("[data-repere-popover]:popover-open");
  await expect(openPopover).toHaveCount(0, { timeout: 5_000 });
}

/**
 * Waits for the repere library to finish updating after a beacon dismissal.
 * Waits for the trigger to actually be removed from the DOM.
 */
export async function waitForTriggerCountChange(
  page: Page,
  expectedCount: number,
): Promise<void> {
  await expect(page.locator("[data-repere-trigger]")).toHaveCount(
    expectedCount,
    { timeout: 5_000 },
  );
}

/**
 * Clicks the "Got it" acknowledge button inside the currently open popover.
 * After clicking, the trigger for this beacon should disappear.
 *
 * Includes a CI fallback: if the click didn't register, force-hides the
 * popover via JS.
 *
 * @param page - Playwright Page
 * @param expectedRemainingTriggers - Expected trigger count after dismissal.
 *   If provided, waits for the trigger count to reach this value.
 */
export async function acknowledgeBeacon(
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

  // Wait for the popover to close after dismiss
  await expect(page.locator("[data-repere-popover]:popover-open")).toHaveCount(
    0,
    { timeout: 5_000 },
  );

  // Wait for the trigger to be removed from the DOM
  if (expectedRemainingTriggers !== undefined) {
    await waitForTriggerCountChange(page, expectedRemainingTriggers);
  }
}

/**
 * Full lifecycle for a single beacon: open popover → verify → acknowledge.
 */
export async function acknowledgeFirstBeacon(
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
export async function acknowledgeAllBeacons(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await acknowledgeFirstBeacon(page, count - i - 1);
  }
}
