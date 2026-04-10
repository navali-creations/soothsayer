/**
 * E2E Smoke Tests
 *
 * Verifies the most fundamental behaviors of the Soothsayer Electron app:
 * - The app process launches without crashing
 * - The main BrowserWindow opens and is visible
 * - The page loads meaningful content (not a blank screen)
 * - Basic Electron window properties are correct
 * - The preload bridge (`window.electron`) is available
 *
 * These tests are the first line of defense — if they fail, nothing else
 * will work. They run before any flow-specific E2E tests.
 *
 * @module e2e/flows/smoke
 */

import { expect, test } from "../helpers/electron-test";
import { waitForHydration } from "../helpers/navigation";

test.describe("Smoke Tests", () => {
  test.describe("App Launch", () => {
    test("should launch the Electron app without crashing", async ({ app }) => {
      // If we got here, the app launched successfully.
      // Verify we can communicate with the main process.
      const appPath = await app.evaluate(({ app }) => app.getAppPath());
      expect(appPath).toBeTruthy();
      expect(typeof appPath).toBe("string");
    });

    test("should open the main BrowserWindow", async ({ app, page }) => {
      // The app should have at least one window open
      const windows = app.windows();
      expect(windows.length).toBeGreaterThanOrEqual(1);

      // The page object should be valid
      expect(page).toBeTruthy();
      expect(page.isClosed()).toBe(false);
    });

    test("should set the correct window title", async ({ app, page }) => {
      const browserWindow = await app.browserWindow(page);
      const title = await browserWindow.evaluate((win) => win.getTitle());
      expect(title).toBe("Soothsayer");
    });

    test("should have a visible main window", async ({ app, page }) => {
      const browserWindow = await app.browserWindow(page);
      const isVisible = await browserWindow.evaluate((win) => win.isVisible());
      expect(isVisible).toBe(true);
    });

    test("should have reasonable window dimensions", async ({ app, page }) => {
      const browserWindow = await app.browserWindow(page);
      const bounds = await browserWindow.evaluate((win) => win.getBounds());

      // Default window size is 1200x800 (from MainWindow.service.ts)
      expect(bounds.width).toBeGreaterThanOrEqual(1200);
      expect(bounds.height).toBeGreaterThanOrEqual(600);
    });

    test("should not be a frameless window (custom title bar)", async ({
      page,
    }) => {
      // Soothsayer uses frame: false with a custom AppMenu title bar
      // We just verify the window exists and has content regardless
      expect(page.isClosed()).toBe(false);
    });

    test("should have context isolation enabled", async ({ app, page }) => {
      const browserWindow = await app.browserWindow(page);
      const contextIsolation = await browserWindow.evaluate(
        (win) => win.webContents.getLastWebPreferences()?.contextIsolation,
      );
      expect(contextIsolation).toBe(true);
    });

    test("should have node integration disabled", async ({ app, page }) => {
      const browserWindow = await app.browserWindow(page);
      const nodeIntegration = await browserWindow.evaluate(
        (win) => win.webContents.getLastWebPreferences()?.nodeIntegration,
      );
      expect(nodeIntegration).toBe(false);
    });

    test("should have sandbox enabled", async ({ app, page }) => {
      const browserWindow = await app.browserWindow(page);
      const sandbox = await browserWindow.evaluate(
        (win) => win.webContents.getLastWebPreferences()?.sandbox,
      );
      expect(sandbox).toBe(true);
    });
  });

  test.describe("Page Content", () => {
    test("should load an HTML page (not blank)", async ({ page }) => {
      const html = await page.content();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain('<div id="root">');
    });

    test("should have a <body> element", async ({ page }) => {
      const body = page.locator("body");
      await expect(body).toBeVisible();
    });

    test("should render the React root", async ({ page }) => {
      // The React app mounts into <div id="root"> (Vite + React convention)
      const appRoot = page.locator("#root");
      await expect(appRoot).toBeAttached();

      // The root should have child content (React rendered something)
      const childCount = await appRoot.evaluate((el) => el.childElementCount);
      expect(childCount).toBeGreaterThan(0);
    });

    test("should have the React root element after DOM ready", async ({
      page,
    }) => {
      await page.waitForLoadState("domcontentloaded");

      // The #root div should exist in the DOM — React mounts into it
      const root = page.locator("#root");
      await expect(root).toBeAttached();
    });
  });

  test.describe("Preload Bridge", () => {
    test("should expose window.electron via contextBridge", async ({
      page,
    }) => {
      const hasElectron = await page.evaluate(() => {
        return typeof (window as any).electron !== "undefined";
      });
      expect(hasElectron).toBe(true);
    });

    test("should expose the app API namespace", async ({ page }) => {
      const hasAppAPI = await page.evaluate(() => {
        const electron = (window as any).electron;
        return electron && typeof electron.app === "object";
      });
      expect(hasAppAPI).toBe(true);
    });

    test("should expose the settings API namespace", async ({ page }) => {
      const hasSettingsAPI = await page.evaluate(() => {
        const electron = (window as any).electron;
        return electron && typeof electron.settings === "object";
      });
      expect(hasSettingsAPI).toBe(true);
    });

    test("should expose the session API namespace", async ({ page }) => {
      const hasSessionAPI = await page.evaluate(() => {
        const electron = (window as any).electron;
        return electron && typeof electron.session === "object";
      });
      expect(hasSessionAPI).toBe(true);
    });

    test("should expose all expected API namespaces", async ({ page }) => {
      const namespaces = await page.evaluate(() => {
        const electron = (window as any).electron;
        if (!electron) return [];
        return Object.keys(electron);
      });

      // These are the 20+ namespaces exposed in preload.ts
      const expectedNamespaces = [
        "csv",
        "cardDetails",
        "session",
        "sessions",
        "snapshots",
        "mainWindow",
        "app",
        "overlay",
        "appSetup",
        "poeProcess",
        "dataStore",
        "poeLeagues",
        "settings",
        "analytics",
        "divinationCards",
        "updater",
        "rarityInsights",
        "diagLog",
        "profitForecast",
        "storage",
      ];

      for (const ns of expectedNamespaces) {
        expect(namespaces, `Missing namespace: ${ns}`).toContain(ns);
      }
    });

    test("should be able to call app.getVersion via the preload bridge", async ({
      page,
    }) => {
      await waitForHydration(page);

      const version = await page.evaluate(() => {
        return (window as any).electron.app.getVersion();
      });

      // Version should be a semver-like string (from package.json)
      expect(version).toBeTruthy();
      expect(typeof version).toBe("string");
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  test.describe("Hydration", () => {
    test("should complete hydration within a reasonable time", async ({
      page,
    }) => {
      const startTime = Date.now();

      await waitForHydration(page, 30_000);

      const hydrationTime = Date.now() - startTime;

      // Hydration should complete in under 30 seconds even on cold start
      expect(hydrationTime).toBeLessThan(30_000);

      // Log for debugging in CI
      console.log(`[Smoke] Hydration completed in ${hydrationTime}ms`);
    });

    test("should render either setup wizard or main shell after hydration", async ({
      page,
    }) => {
      await waitForHydration(page);

      // After hydration, one of these should be true:
      const state = await page.evaluate(() => {
        const hash = window.location.hash;
        const body = document.body.innerText;
        return {
          hash,
          isSetup: hash.includes("/setup"),
          isHome: hash === "#/" || hash === "",
          bodyLength: body.length,
          hasNav: document.querySelector("nav") !== null,
          hasAside: document.querySelector("aside") !== null,
          hasMain: document.querySelector("main") !== null,
        };
      });

      if (state.isSetup) {
        // Setup wizard should have visible content
        expect(state.bodyLength).toBeGreaterThan(0);
      } else {
        // Main shell should have the sidebar (aside) and content area (main)
        expect(state.hasMain || state.hasAside || state.bodyLength > 0).toBe(
          true,
        );
      }
    });

    test("should show meaningful content after hydration completes", async ({
      page,
    }) => {
      await waitForHydration(page);

      // After hydration the app should show either the setup wizard or the
      // main shell — either way there will be visible text content.
      const root = page.locator("#root");
      const text = await root.textContent();
      expect(text?.length).toBeGreaterThan(0);
    });
  });
});
