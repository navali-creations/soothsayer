/**
 * E2E Navigation Helpers
 *
 * Utilities for navigating within the Soothsayer Electron app during E2E tests.
 * Soothsayer uses TanStack Router with `createHashHistory()`, so all routes
 * are under the `#/` prefix in the URL.
 *
 * @module e2e/helpers/navigation
 */

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { mockSetupComplete } from "./ipc-helpers";

/**
 * Known routes in the Soothsayer app.
 * These match the TanStack Router route tree defined in `renderer/routeTree.gen.ts`.
 */
export const ROUTES = {
  HOME: "/",
  SETUP: "/setup",
  SESSIONS: "/sessions",
  SESSION_DETAILS: "/sessions/$sessionId",
  CARDS: "/cards",
  CARD_DETAILS: "/cards/$cardSlug",
  STATISTICS: "/statistics",
  PROFIT_FORECAST: "/profit-forecast",
  RARITY_INSIGHTS: "/rarity-insights",
  SETTINGS: "/settings",
  CHANGELOG: "/changelog",
  PRIVACY_POLICY: "/privacy-policy",
  ATTRIBUTIONS: "/attributions",
} as const;

export type AppRoute = (typeof ROUTES)[keyof typeof ROUTES];

/**
 * Waits for the app to finish hydrating after initial launch.
 *
 * The root layout (`__root.tsx`) shows a loading spinner with the text
 * "Loading Soothsayer..." while it calls `hydrate()` and `startListeners()`.
 * Once hydration completes, the spinner is removed and either the setup wizard
 * or the main app shell (with sidebar) is rendered.
 *
 * @param page - The Playwright Page (main Electron window)
 * @param timeout - Max time (ms) to wait for hydration. Defaults to 30s to account for
 *                  cold Vite dev server starts and SQLite/Supabase initialization.
 */
export async function waitForHydration(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  // Strategy: wait for the loading spinner to disappear.
  // The spinner has class `animate-spin` inside a container with "Loading Soothsayer..." text.
  // Once hydration finishes, the root layout renders either:
  //   - The setup wizard (if setup is incomplete) — route redirects to /setup
  //   - The main shell with <Sidebar /> + <Outlet /> (if setup is complete)

  // First, wait for some content to appear at all (the page loaded)
  await page.waitForLoadState("domcontentloaded", { timeout: 15_000 });

  // Wait for the hydration spinner to appear and then disappear.
  // If the app hydrates very fast, the spinner might never appear, so we
  // handle both cases with a race.
  try {
    // Give the spinner a brief moment to appear
    const spinner = page.locator(".animate-spin").first();
    const spinnerVisible = await spinner
      .isVisible({ timeout: 3_000 })
      .catch(() => false);

    if (spinnerVisible) {
      // Wait for it to disappear (hydration complete)
      await spinner.waitFor({ state: "detached", timeout });
    }
  } catch {
    // Spinner never appeared or disappeared very quickly — that's fine
  }

  // Now wait for meaningful content: either the sidebar (post-setup) or setup container
  await page.waitForFunction(
    () => {
      const body = document.body;
      if (!body) return false;
      const text = body.innerText || "";
      // After hydration, we should see either setup content or app navigation
      return (
        text.includes("Current Session") ||
        text.includes("Soothsayer") ||
        text.includes("Select") || // Setup wizard steps
        document.querySelector("nav") !== null ||
        document.querySelector("aside") !== null ||
        document.querySelector("main") !== null
      );
    },
    { timeout },
  );
}

/**
 * Navigates to a route within the Soothsayer app.
 *
 * Uses hash-based routing (`window.location.hash = '#/route'`) since
 * Soothsayer uses TanStack Router with `createHashHistory()` for
 * Electron's `file://` protocol compatibility.
 *
 * @param page - The Playwright Page (main Electron window)
 * @param route - The route path, e.g. "/cards" or "/settings"
 * @param options - Optional settings for the navigation
 */
export async function navigateTo(
  page: Page,
  route: string,
  options: { waitForNavigation?: boolean; timeout?: number } = {},
): Promise<void> {
  const { waitForNavigation = true, timeout = 10_000 } = options;
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;

  await page.evaluate((r) => {
    window.location.hash = `#${r}`;
  }, normalizedRoute);

  if (waitForNavigation) {
    // Wait for React to process the route change and render content
    await page.waitForFunction(
      (expectedHash) => window.location.hash === expectedHash,
      `#${normalizedRoute}`,
      { timeout },
    );

    // Allow React to settle after the route change
    await page.waitForTimeout(200);
  }
}

/**
 * Waits for the app to be on a specific route.
 *
 * @param page - The Playwright Page
 * @param route - The expected route (e.g. "/cards", "/setup")
 * @param timeout - Max wait time in ms
 */
export async function waitForRoute(
  page: Page,
  route: string,
  timeout = 10_000,
): Promise<void> {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const expectedHash = `#${normalizedRoute}`;

  await page.waitForFunction(
    (hash) => window.location.hash === hash,
    expectedHash,
    { timeout },
  );
}

/**
 * Asserts the current route matches the expected route.
 *
 * @param page - The Playwright Page
 * @param expectedRoute - The expected route path (e.g. "/cards")
 */
export async function expectRoute(
  page: Page,
  expectedRoute: string,
): Promise<void> {
  const normalizedRoute = expectedRoute.startsWith("/")
    ? expectedRoute
    : `/${expectedRoute}`;
  const expectedHash = `#${normalizedRoute}`;
  const currentHash = await page.evaluate(() => window.location.hash);
  expect(currentHash).toBe(expectedHash);
}

/**
 * Asserts the current route starts with a given prefix.
 * Useful for dynamic routes like `/cards/$cardSlug` or `/sessions/$sessionId`.
 *
 * @param page - The Playwright Page
 * @param routePrefix - The expected route prefix (e.g. "/cards/")
 */
export async function expectRouteStartsWith(
  page: Page,
  routePrefix: string,
): Promise<void> {
  const normalizedPrefix = routePrefix.startsWith("/")
    ? routePrefix
    : `/${routePrefix}`;
  const expectedHashPrefix = `#${normalizedPrefix}`;
  const currentHash = await page.evaluate(() => window.location.hash);
  expect(currentHash.startsWith(expectedHashPrefix)).toBe(true);
}

/**
 * Gets the current route path (without the hash prefix).
 *
 * @param page - The Playwright Page
 * @returns The current route, e.g. "/cards" or "/setup"
 */
export async function getCurrentRoute(page: Page): Promise<string> {
  const hash = await page.evaluate(() => window.location.hash);
  // Remove the leading "#" to get the route path
  return hash.startsWith("#") ? hash.slice(1) : hash;
}

/**
 * Clicks a sidebar navigation link by its label text.
 * The sidebar is only visible when setup is complete.
 *
 * @param page - The Playwright Page
 * @param label - The visible text of the nav link (e.g. "Current Session", "Cards", "Sessions")
 */
export async function clickSidebarLink(
  page: Page,
  label: string,
): Promise<void> {
  // Dismiss any open <dialog> elements (modals, confirmation dialogs) that
  // might have a transparent modal-backdrop <button>close</button> covering
  // the sidebar and intercepting pointer events.
  await page
    .evaluate(() => {
      document.querySelectorAll("dialog[open]").forEach((d) => {
        (d as HTMLDialogElement).close();
      });
    })
    .catch(() => {});

  // Also try clicking any visible close button inside <main> as a fallback
  const closeBtn = page.locator("main button:has-text('close')").first();
  if (await closeBtn.isVisible({ timeout: 300 }).catch(() => false)) {
    await closeBtn.click({ timeout: 1_000 }).catch(() => {});
  }

  // Brief settle after dismissing overlays
  await page.waitForTimeout(200);

  // The sidebar uses <Nav /> with link labels
  const link = page.locator("aside").getByText(label, { exact: true });

  try {
    await link.click({ timeout: 10_000 });
  } catch {
    // If an overlay still intercepts, force the click as a fallback
    await link.click({ force: true });
  }

  // Wait for navigation to settle
  await page.waitForTimeout(300);
}

/**
 * Waits for a specific text to appear on the page.
 * Useful as a simple "page loaded" check after navigation.
 *
 * @param page - The Playwright Page
 * @param text - The text to wait for
 * @param timeout - Max wait time in ms
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout = 10_000,
): Promise<void> {
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
}

/**
 * Waits for the setup wizard to be displayed.
 * The setup wizard is shown when `isSetupComplete()` returns false after hydration.
 */
export async function waitForSetupWizard(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  // After hydration, the root layout redirects to /setup if setup is incomplete.
  // The setup page auto-advances from step 0 to step 1 (SELECT_GAME).
  // Wait for the setup UI to be visible.
  await waitForHydration(page, timeout);
  await waitForRoute(page, "/setup", 10_000);
}

/**
 * Waits for the main app shell (post-setup) to be displayed.
 * The main shell includes the sidebar navigation and the current session page.
 */
export async function waitForMainShell(
  page: Page,
  timeout = 30_000,
): Promise<void> {
  await waitForHydration(page, timeout);

  // The main shell should have an <aside> (sidebar) and <main> (content area)
  await page.locator("aside").waitFor({ state: "visible", timeout: 10_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Ensures the app is past the setup wizard and on the main shell.
 * If the current route is `/setup` or empty, completes setup programmatically
 * and waits for the sidebar to become visible.
 *
 * @param page - The Playwright Page (main Electron window)
 */
export async function ensurePostSetup(page: Page): Promise<void> {
  await waitForHydration(page, 45_000);
  const currentRoute = await getCurrentRoute(page);
  if (currentRoute === "/setup" || currentRoute === "") {
    await mockSetupComplete(page);
    await waitForHydration(page, 30_000);
  }
  await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });
}
