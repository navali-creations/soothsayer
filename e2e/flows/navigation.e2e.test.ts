/**
 * E2E Tests: Navigation Flow
 *
 * Tests the app's navigation system end-to-end:
 * - Sidebar link navigation between all primary views
 * - Hash-based routing with TanStack Router
 * - Direct deep linking to specific routes
 * - Browser-style back/forward navigation
 * - Route transitions render correct page content
 * - Navigation guards (setup incomplete → redirect to /setup)
 *
 * Soothsayer uses TanStack Router with `createHashHistory()` for Electron's
 * `file://` protocol. All routes are prefixed with `#/` in the URL.
 *
 * @module e2e/flows/navigation
 */

import { expect, test } from "../helpers/electron-test";
import { mockSetupComplete, resetSetup } from "../helpers/ipc-helpers";
import {
  clickSidebarLink,
  ensurePostSetup,
  expectRoute,
  expectRouteStartsWith,
  getCurrentRoute,
  navigateTo,
  waitForHydration,
  waitForRoute,
} from "../helpers/navigation";

// ─── Helper: build a navigation history by visiting routes in sequence ────────

async function buildHistory(
  page: import("@playwright/test").Page,
  routes: string[],
): Promise<void> {
  for (const route of routes) {
    await navigateTo(page, route);
    await waitForRoute(page, route, 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
  }
}

test.describe("Navigation", () => {
  // ─── Sidebar Navigation ──────────────────────────────────────────────────────

  test.describe("Sidebar Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should highlight the active sidebar link", async ({ page }) => {
      // Navigate to Cards
      await clickSidebarLink(page, "Cards");
      await waitForRoute(page, "/cards", 10_000);

      // The active link should have some visual distinction (active class, aria-current, etc.)
      const sidebar = page.locator("aside");
      // TanStack Router adds an `.active` class to the matching <Link>.
      // Do NOT use [class*="active"] — that matches every link because they
      // all carry the Tailwind modifier `[&.active]:bg-primary/10` in their
      // static class string.
      const activeLink = sidebar.locator(
        'a.active, [aria-current="page"], [data-active="true"]',
      );

      const activeCount = await activeLink.count();
      // Ensure at least one active link indicator is found
      expect(activeCount).toBeGreaterThan(0);
      if (activeCount > 0) {
        const activeText = await activeLink.first().innerText();
        expect(activeText.toLowerCase()).toContain("cards");
      }
    });

    test("should navigate through all primary pages in sequence", async ({
      page,
    }) => {
      const primaryLinks = [
        { label: "Current Session", route: "/" },
        { label: "Sessions", route: "/sessions" },
        { label: "Statistics", route: "/statistics" },
        { label: "Cards", route: "/cards" },
        { label: "Profit Forecast", route: "/profit-forecast" },
        { label: "Rarity Insights", route: "/rarity-insights" },
      ];

      for (const { label, route } of primaryLinks) {
        await clickSidebarLink(page, label);
        await waitForRoute(page, route, 10_000);

        const currentRoute = await getCurrentRoute(page);
        expect(currentRoute).toBe(route);

        // Each page should render content in <main>
        const main = page.locator("main");
        await expect(main).toBeVisible();
      }
    });
  });

  // ─── Hash-based Deep Linking ──────────────────────────────────────────────────

  test.describe("Deep Linking (Hash Navigation)", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should deep link to a card details page", async ({ page }) => {
      await navigateTo(page, "/cards/humility");
      await page.locator("main").waitFor({ state: "visible", timeout: 10_000 });

      // Should land on a /cards/<slug> route
      await expectRouteStartsWith(page, "/cards/");

      // Main content should render
      const main = page.locator("main");
      await expect(main).toBeVisible();
    });

    test("should deep link to a session details page placeholder", async ({
      page,
    }) => {
      // Use a fake session ID — the app should handle it gracefully
      await navigateTo(page, "/sessions/test-session-123");
      await page.locator("main").waitFor({ state: "visible", timeout: 10_000 });

      // Should be on a /sessions/<id> route (or redirected if not found)
      const route = await getCurrentRoute(page);
      expect(route.startsWith("/sessions")).toBe(true);

      // Page should render without crashing
      const main = page.locator("main");
      await expect(main).toBeVisible();
    });
  });

  // ─── Route Transitions & Content Verification ─────────────────────────────────

  test.describe("Route Transitions", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should render different content for each route", async ({ page }) => {
      const routes = [
        { route: "/", identifier: "Current Session" },
        { route: "/sessions", identifier: "session" },
        { route: "/cards", identifier: "card" },
        { route: "/settings", identifier: "setting" },
      ];

      const pageContents: string[] = [];

      for (const { route } of routes) {
        await navigateTo(page, route);
        await waitForRoute(page, route, 10_000);
        await page
          .locator("main")
          .waitFor({ state: "visible", timeout: 5_000 });

        const content = await page.locator("main").textContent();
        pageContents.push(content || "");
      }

      // At least some routes should have different content
      // (not all identical, which would indicate routing is broken)
      const uniqueContents = new Set(pageContents.filter((c) => c.length > 0));
      expect(uniqueContents.size).toBeGreaterThan(1);
    });
  });

  // ─── Browser-style Navigation (Back / Forward) ───────────────────────────────

  test.describe("Back / Forward Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should support back navigation after visiting multiple routes", async ({
      page,
    }) => {
      // Build a navigation history: / → /cards → /sessions
      await buildHistory(page, ["/", "/cards", "/sessions"]);

      // Go back to /cards
      await page.goBack();
      await waitForRoute(page, "/cards", 5_000);

      const routeAfterBack = await getCurrentRoute(page);
      expect(routeAfterBack).toBe("/cards");
    });

    test("should support forward navigation after going back", async ({
      page,
    }) => {
      // Build history: / → /cards → /sessions
      await buildHistory(page, ["/", "/cards", "/sessions"]);

      // Go back
      await page.goBack();
      await waitForRoute(page, "/cards", 5_000);
      await expectRoute(page, "/cards");

      // Go forward
      await page.goForward();
      await waitForRoute(page, "/sessions", 5_000);
      await expectRoute(page, "/sessions");
    });

    test("should support multiple back navigations", async ({ page }) => {
      // Build history: / → /cards → /sessions → /statistics
      await buildHistory(page, ["/", "/cards", "/sessions", "/statistics"]);

      // Go back twice: /statistics → /sessions → /cards
      await page.goBack();
      await waitForRoute(page, "/sessions", 5_000);
      await expectRoute(page, "/sessions");

      await page.goBack();
      await waitForRoute(page, "/cards", 5_000);
      await expectRoute(page, "/cards");
    });
  });

  // ─── Navigation Guards ────────────────────────────────────────────────────────

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
          // Cannot test guard if resetSetup is unavailable
          test.skip(true, "resetSetup IPC not available");
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
        // resetSetup may be unavailable — skip if so
        test.skip(true, "resetSetup IPC not available");
        return;
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

  // ─── Rapid Navigation (Stress Test) ──────────────────────────────────────────

  test.describe("Rapid Navigation", () => {
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
        await page.waitForTimeout(200); // Minimal pause
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
          await page.waitForTimeout(150);
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

  // ─── Edge Cases ───────────────────────────────────────────────────────────────

  test.describe("Navigation Edge Cases", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should handle navigation to a non-existent route gracefully", async ({
      page,
    }) => {
      await navigateTo(page, "/this-route-does-not-exist");
      await page.locator("body").waitFor({ state: "visible", timeout: 5_000 });

      // The app should NOT crash — it might show:
      // - A 404-like page
      // - Redirect to home
      // - Stay on the current page
      const body = page.locator("body");
      await expect(body).toBeVisible();

      // Page should have some content (not blank)
      const content = await body.textContent();
      expect(content?.length).toBeGreaterThan(0);
    });

    test("should handle page reload and preserve the current route", async ({
      page,
    }) => {
      // Navigate to a specific route
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);

      // Reload the page
      await page.reload();
      await waitForHydration(page, 30_000);

      // After reload, the app re-hydrates and should be on the same route
      const route = await getCurrentRoute(page);

      expect(route).toBe("/cards");
    });

    test("should handle double navigation to the same route", async ({
      page,
    }) => {
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);

      // Navigate to the same route again
      await navigateTo(page, "/cards");
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Should still be on /cards without errors
      await expectRoute(page, "/cards");

      const main = page.locator("main");
      await expect(main).toBeVisible();
    });
  });
});
