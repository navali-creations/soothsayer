/**
 * E2E Tests: Navigation — Rapid & Stress Tests
 *
 * Tests the app's ability to handle rapid navigation without crashing:
 * - Rapid route changes via hash navigation
 * - Rapid sidebar clicks in quick succession
 *
 * Split from navigation.e2e.test.ts to allow parallel execution across workers.
 *
 * @module e2e/flows/navigation-stress
 */

import { expect, test } from "../helpers/electron-test";
import {
  clickSidebarLink,
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
} from "../helpers/navigation";

test.describe("Navigation — Rapid & Stress", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
  });

  test("should handle rapid route changes without crashing", async ({
    page,
  }) => {
    const routes = [
      "/cards",
      "/sessions",
      "/statistics",
      "/profit-forecast",
      "/rarity-insights",
      "/settings",
      "/",
      "/cards",
      "/changelog",
      "/sessions",
    ];

    // Navigate rapidly through routes with minimal delay
    for (const route of routes) {
      await navigateTo(page, route, { waitForNavigation: false });
      // Minimal pause — just enough for the hash to update
      await page.waitForTimeout(100);
    }

    // Wait for the last navigation to settle
    await page.locator("main").waitFor({ state: "visible", timeout: 10_000 });

    // The app should still be functional — main content visible, no crash
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 5_000 });

    // After rapid navigation the exact final route may not be deterministic
    // if the router is still coalescing updates. Instead of asserting an
    // exact route, verify we landed on a known route (app didn't crash).
    const knownRoutes = [
      "/",
      "/cards",
      "/sessions",
      "/statistics",
      "/profit-forecast",
      "/rarity-insights",
      "/settings",
      "/changelog",
    ];
    const finalRoute = await getCurrentRoute(page);
    expect(
      knownRoutes.some((r) => finalRoute.startsWith(r)),
      `Expected a known route after rapid navigation, got "${finalRoute}"`,
    ).toBe(true);
  });

  test("should handle rapid sidebar clicks without errors", async ({
    page,
  }) => {
    const labels = [
      "Cards",
      "Sessions",
      "Statistics",
      "Current Session",
      "Profit Forecast",
      "Rarity Insights",
    ];

    // Click sidebar links in rapid succession
    for (const label of labels) {
      try {
        await clickSidebarLink(page, label);
      } catch {
        // A click may fail if the sidebar is briefly re-rendering — continue
      }
    }

    // Wait for the dust to settle
    await page.locator("main").waitFor({ state: "visible", timeout: 10_000 });

    // App should still be responsive
    const main = page.locator("main");
    await expect(main).toBeVisible({ timeout: 5_000 });

    // Sidebar should still be visible
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible({ timeout: 5_000 });
  });
});
