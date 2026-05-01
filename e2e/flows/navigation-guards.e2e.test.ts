/**
 * E2E Tests: Navigation Guards
 *
 * Tests the app's navigation guard system:
 * - Setup incomplete → redirect to /setup
 * - Sidebar visibility based on setup state
 *
 * Split from navigation.e2e.test.ts to allow parallel execution across workers.
 *
 * @module e2e/flows/navigation-guards
 */

import { expect, test } from "../helpers/electron-test";
import { mockSetupComplete, resetSetup } from "../helpers/ipc-helpers";
import {
  getCurrentRoute,
  navigateTo,
  waitForHydration,
  waitForRoute,
} from "../helpers/navigation";

test.describe("Navigation Guards", () => {
  test("should redirect to /setup when setup is incomplete", async ({
    page,
  }) => {
    await waitForHydration(page, 45_000);

    // Check if we're already on /setup (fresh install)
    const route = await getCurrentRoute(page);

    if (route === "/setup") {
      // Verify that trying to navigate away redirects back
      await page.evaluate(() => {
        window.location.hash = "#/cards";
      });
      await waitForRoute(page, "/setup", 5_000);

      const routeAfter = await getCurrentRoute(page);
      // The navigation guard should prevent leaving /setup
      expect(routeAfter).toBe("/setup");
    } else {
      // Setup is already complete — reset it to test the guard
      try {
        await page.evaluate(async () => {
          const electron = (window as any).electron;
          if (electron?.appSetup?.resetSetup) {
            await electron.appSetup.resetSetup();
          }
        });

        await page.reload();
        await waitForHydration(page, 30_000);

        const routeAfterReset = await getCurrentRoute(page);
        expect(routeAfterReset).toBe("/setup");
      } catch {
        throw new Error("resetSetup IPC not available");
      }
    }
  });

  test("should show the sidebar only when setup is complete", async ({
    page,
  }) => {
    await waitForHydration(page, 45_000);

    // Force setup-incomplete state so we can test both phases
    try {
      await resetSetup(page);
      await waitForHydration(page, 30_000);
    } catch {
      throw new Error("resetSetup IPC not available");
    }

    const route = await getCurrentRoute(page);
    if (route !== "/setup") {
      // If we're still not on /setup after reset, navigate there
      await navigateTo(page, "/setup");
      await waitForHydration(page, 15_000);
    }

    // During setup, sidebar should NOT be visible
    const sidebar = page.locator("aside");
    const sidebarVisible = await sidebar.isVisible().catch(() => false);
    expect(sidebarVisible).toBe(false);

    // Complete setup
    await mockSetupComplete(page);
    await waitForHydration(page, 30_000);

    // Now sidebar SHOULD be visible
    const sidebarAfter = page.locator("aside");
    await expect(sidebarAfter).toBeVisible({ timeout: 10_000 });
  });
});
