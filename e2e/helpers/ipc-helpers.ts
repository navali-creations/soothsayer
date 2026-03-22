/**
 * IPC Helper Utilities for E2E Tests
 *
 * Provides utilities for interacting with Electron's IPC layer during E2E tests.
 * These helpers use Playwright's `electronApp.evaluate()` to execute code in the
 * main process, enabling tests to:
 *
 * - Inspect or mock IPC handler responses
 * - Manipulate main-process state (e.g., mark setup as complete)
 * - Trigger main→renderer events
 * - Query the database or settings store directly
 *
 * @module e2e/helpers/ipc-helpers
 */

import type { ElectronApplication, Page } from "@playwright/test";

/**
 * Evaluates a function in the Electron main process.
 * This is a typed convenience wrapper around `electronApp.evaluate()`.
 *
 * @example
 * ```ts
 * const version = await evaluateMain(app, ({ app }) => app.getVersion());
 * ```
 */
export async function evaluateMain<R>(
  electronApp: ElectronApplication,
  fn: (electron: typeof Electron.CrossProcessExports) => R | Promise<R>,
): Promise<R> {
  return electronApp.evaluate(fn as any);
}

/**
 * Gets the app version from the main process.
 */
export async function getAppVersion(
  electronApp: ElectronApplication,
): Promise<string> {
  return electronApp.evaluate(({ app }) => app.getVersion());
}

/**
 * Gets the app's user data path (where settings/DB are stored).
 */
export async function getUserDataPath(
  electronApp: ElectronApplication,
): Promise<string> {
  return electronApp.evaluate(({ app }) => app.getPath("userData"));
}

/**
 * Gets the app path (the root of the application).
 */
export async function getAppPath(
  electronApp: ElectronApplication,
): Promise<string> {
  return electronApp.evaluate(({ app }) => app.getAppPath());
}

/**
 * Checks whether the main window is currently visible.
 */
export async function isMainWindowVisible(
  electronApp: ElectronApplication,
): Promise<boolean> {
  const page = await electronApp.firstWindow();
  const browserWindow = await electronApp.browserWindow(page);
  return browserWindow.evaluate((win) => win.isVisible());
}

/**
 * Checks if the main window is maximized.
 */
export async function isMainWindowMaximized(
  electronApp: ElectronApplication,
): Promise<boolean> {
  const page = await electronApp.firstWindow();
  const browserWindow = await electronApp.browserWindow(page);
  return browserWindow.evaluate((win) => win.isMaximized());
}

/**
 * Calls a method on the `window.electron` API object exposed by the preload script.
 * This is the primary way to interact with Soothsayer's IPC surface from E2E tests.
 *
 * @param page - The Playwright Page (renderer)
 * @param namespace - The API namespace (e.g., "app", "session", "settings")
 * @param method - The method name within the namespace
 * @param args - Arguments to pass to the method
 *
 * @example
 * ```ts
 * const version = await callElectronAPI(page, "app", "getVersion");
 * const settings = await callElectronAPI(page, "settings", "getAll");
 * ```
 */
export async function callElectronAPI<R = unknown>(
  page: Page,
  namespace: string,
  method: string,
  ...args: unknown[]
): Promise<R> {
  return page.evaluate(
    ({ namespace, method, args }) => {
      const electron = (window as any).electron;
      if (!electron) {
        throw new Error("window.electron is not available");
      }
      const api = electron[namespace];
      if (!api) {
        throw new Error(`window.electron.${namespace} is not available`);
      }
      const fn = api[method];
      if (typeof fn !== "function") {
        throw new Error(
          `window.electron.${namespace}.${method} is not a function`,
        );
      }
      return fn(...args);
    },
    { namespace, method, args },
  );
}

/**
 * Gets all settings from the settings store via the renderer's preload API.
 */
export async function getAllSettings(
  page: Page,
): Promise<Record<string, unknown>> {
  return callElectronAPI(page, "settings", "getAll");
}

/**
 * Gets a specific setting value.
 */
export async function getSetting<R = unknown>(
  page: Page,
  key: string,
): Promise<R> {
  return callElectronAPI<R>(page, "settings", "get", key);
}

/**
 * Sets a setting value via the preload API.
 */
export async function setSetting(
  page: Page,
  key: string,
  value: unknown,
): Promise<void> {
  await callElectronAPI(page, "settings", "set", key, value);
}

/**
 * Gets the current setup state from the app-setup module.
 */
export async function getSetupState(page: Page): Promise<unknown> {
  return callElectronAPI(page, "appSetup", "getSetupState");
}

/**
 * Checks if the app setup is complete.
 */
export async function isSetupComplete(page: Page): Promise<boolean> {
  return callElectronAPI<boolean>(page, "appSetup", "isSetupComplete");
}

/**
 * Advances the setup wizard to the next step.
 */
export async function advanceSetupStep(page: Page): Promise<unknown> {
  return callElectronAPI(page, "appSetup", "advanceStep");
}

/**
 * Completes the setup wizard programmatically.
 * Useful for tests that don't focus on the setup flow itself but need the app
 * to be in a post-setup state.
 */
export async function completeSetup(page: Page): Promise<void> {
  await callElectronAPI(page, "appSetup", "completeSetup");
}

/**
 * Resets the setup state so the app returns to the setup wizard.
 * Useful for testing the setup flow from scratch.
 */
export async function resetSetup(page: Page): Promise<void> {
  await callElectronAPI(page, "appSetup", "resetSetup");
}

/**
 * Skips the setup wizard entirely (marks it as complete with defaults).
 */
export async function skipSetup(page: Page): Promise<void> {
  await callElectronAPI(page, "appSetup", "skipSetup");
}

/**
 * Pre-configures the app to behave as if setup is complete.
 * Calls `skipSetup` via the preload bridge, then reloads the page so the
 * root layout picks up the completed state and skips the setup redirect.
 *
 * @param page - Playwright Page for the main window
 */
export async function mockSetupComplete(page: Page): Promise<void> {
  await skipSetup(page);
  // Reload so the root layout re-hydrates with setup complete
  await page.reload();
  await page.waitForLoadState("domcontentloaded");

  // After reload the root layout hydrates, then the SetupRoute component's
  // useEffect sees isComplete=true and calls navigate({ to: "/" }).
  // This redirect is asynchronous — wait for the spinner to disappear and
  // then for the hash to settle on "/" before returning.
  // 1. Wait for meaningful content (hydration complete).
  // Under heavy parallel load (3+ Electron workers sharing CPU/GPU) the Vite
  // dev-server response and React hydration can take well over 30 s, so we
  // use a generous 45 s timeout here.
  await page.waitForFunction(
    () => {
      const body = document.body;
      if (!body) return false;
      const text = body.innerText || "";
      return (
        text.includes("Current Session") ||
        text.includes("Soothsayer") ||
        document.querySelector("nav") !== null ||
        document.querySelector("aside") !== null ||
        document.querySelector("main") !== null
      );
    },
    { timeout: 45_000 },
  );
  // 2. Wait for the /setup → / redirect to complete.
  // Under heavy parallel load (multiple Electron workers) the redirect can be
  // slow. If the hash is still on /setup after waiting, force-navigate to "/".
  try {
    await page.waitForFunction(
      () => {
        const hash = window.location.hash;
        return hash === "#/" || hash === "#" || hash === "";
      },
      { timeout: 30_000 },
    );
  } catch {
    // The redirect didn't happen in time — force it.  This can occur when
    // TanStack Router's useEffect hasn't fired yet due to resource contention.
    const stuckHash = await page.evaluate(() => window.location.hash);
    if (stuckHash === "#/setup" || stuckHash === "") {
      await page.evaluate(() => {
        window.location.hash = "#/";
      });
      await page.waitForFunction(() => window.location.hash === "#/", {
        timeout: 5_000,
      });
    }
  }
}

/**
 * Pre-configures the app to behave as if setup is NOT complete.
 * Resets setup state and reloads so the root layout redirects to /setup.
 *
 * @param page - Playwright Page for the main window
 */
export async function mockSetupIncomplete(page: Page): Promise<void> {
  await resetSetup(page);
  await page.reload();
  await page.waitForLoadState("domcontentloaded");

  // Wait for the root layout to hydrate and redirect to /setup
  await page.waitForFunction(() => window.location.hash === "#/setup", {
    timeout: 15_000,
  });
}

/**
 * Gets the current session data (if a tracking session is active).
 * The CurrentSessionAPI method is `getCurrent`, and it requires a `game` argument.
 */
export async function getCurrentSession(
  page: Page,
  game: "poe1" | "poe2" = "poe1",
): Promise<unknown> {
  return callElectronAPI(page, "session", "getCurrent", game);
}

/**
 * Checks if a tracking session is currently active.
 * The CurrentSessionAPI `isActive` method requires a `game` argument.
 */
export async function isSessionActive(
  page: Page,
  game: "poe1" | "poe2" = "poe1",
): Promise<boolean> {
  return callElectronAPI<boolean>(page, "session", "isActive", game);
}

/**
 * Starts a new tracking session.
 * The CurrentSessionAPI `start` method requires `game` and `league` arguments.
 */
export async function startSession(
  page: Page,
  game: "poe1" | "poe2" = "poe1",
  league: string = "Standard",
): Promise<unknown> {
  return callElectronAPI(page, "session", "start", game, league);
}

/**
 * Stops the current tracking session.
 * The CurrentSessionAPI `stop` method requires a `game` argument.
 */
export async function stopSession(
  page: Page,
  game: "poe1" | "poe2" = "poe1",
): Promise<unknown> {
  return callElectronAPI(page, "session", "stop", game);
}

/**
 * Gets all divination cards from the main process.
 */
export async function getAllCards(page: Page): Promise<unknown[]> {
  return callElectronAPI<unknown[]>(page, "divinationCards", "getAll");
}

/**
 * Searches for divination cards by name.
 */
export async function searchCards(
  page: Page,
  query: string,
): Promise<unknown[]> {
  return callElectronAPI<unknown[]>(
    page,
    "divinationCards",
    "searchByName",
    query,
  );
}

/**
 * Gets the list of available PoE leagues.
 */
export async function getLeagues(page: Page): Promise<unknown[]> {
  return callElectronAPI<unknown[]>(page, "poeLeagues", "fetchLeagues");
}

/**
 * Gets the currently selected league.
 */
export async function getSelectedLeague(page: Page): Promise<unknown> {
  return callElectronAPI(page, "poeLeagues", "getSelectedLeague");
}

/**
 * Selects a PoE league.
 */
export async function selectLeague(
  page: Page,
  leagueId: string,
): Promise<void> {
  await callElectronAPI(page, "poeLeagues", "selectLeague", leagueId);
}

/**
 * Sends an event from the main process to the renderer.
 * Uses `webContents.send()` on the main window.
 *
 * @param electronApp - The Playwright ElectronApplication
 * @param channel - The IPC channel name
 * @param data - The data payload to send
 */
export async function sendToRenderer(
  electronApp: ElectronApplication,
  channel: string,
  data?: unknown,
): Promise<void> {
  await electronApp.evaluate(
    ({ BrowserWindow }, { channel, data }) => {
      const windows = BrowserWindow.getAllWindows();
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.webContents.send(channel, data);
        }
      }
    },
    { channel, data },
  );
}

/**
 * Resets the app's database (danger zone — for clean test state).
 * This calls the settings store's `resetDatabase` method.
 */
export async function resetDatabase(page: Page): Promise<void> {
  await callElectronAPI(page, "settings", "resetDatabase");
}

/**
 * Waits for an IPC event from the main process to be received in the renderer.
 * Sets up a one-time listener and returns the event data.
 *
 * @param page - The Playwright Page
 * @param namespace - The electron API namespace
 * @param eventName - The event registration method name (e.g., "onVisibilityChanged")
 * @param timeout - Max time to wait for the event (ms)
 */
export async function waitForIPCEvent<R = unknown>(
  page: Page,
  namespace: string,
  eventName: string,
  timeout = 10_000,
): Promise<R> {
  return page.evaluate(
    ({ namespace, eventName, timeout }) => {
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(`Timed out waiting for ${namespace}.${eventName}`),
            ),
          timeout,
        );

        const electron = (window as any).electron;
        if (!electron?.[namespace]?.[eventName]) {
          clearTimeout(timer);
          reject(
            new Error(
              `window.electron.${namespace}.${eventName} is not available`,
            ),
          );
          return;
        }

        const cleanup = electron[namespace][eventName]((data: any) => {
          clearTimeout(timer);
          if (typeof cleanup === "function") cleanup();
          resolve(data);
        });
      });
    },
    { namespace, eventName, timeout },
  );
}
