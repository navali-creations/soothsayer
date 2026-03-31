import { resolve } from "node:path";

import {
  type ElectronApplication,
  _electron as electron,
  type Page,
} from "@playwright/test";

const PROJECT_ROOT = resolve(__dirname, "../..");

export interface LaunchAppOptions {
  env?: Record<string, string>;
  windowTimeout?: number;
  args?: string[];
  locale?: string;
  colorScheme?: "light" | "dark" | "no-preference";
}

export interface AppContext {
  electronApp: ElectronApplication;
  mainWindow: Page;
}

export async function launchApp(
  options: LaunchAppOptions = {},
): Promise<AppContext> {
  const {
    env = {},
    windowTimeout = 30_000,
    args = [],
    locale,
    colorScheme,
  } = options;

  const mainEntry = resolve(PROJECT_ROOT, ".vite/build/main.js");

  const electronApp = await electron.launch({
    args: [mainEntry, ...args],
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      NODE_ENV: "test",
      E2E_TESTING: "true",
      SENTRY_DSN: "",
      UMAMI_WEBSITE_ID: "",
      ...env,
    },
    locale,
    colorScheme,
  });

  const mainWindow = await electronApp.firstWindow({ timeout: windowTimeout });
  await mainWindow.waitForLoadState("domcontentloaded");

  return { electronApp, mainWindow };
}

export async function closeApp(
  ctx: AppContext | null | undefined,
): Promise<void> {
  if (!ctx?.electronApp) return;
  try {
    await ctx.electronApp.close();
  } catch {
    // App may have already been closed
  }
}

export async function getWindowTitle(ctx: AppContext): Promise<string> {
  const browserWindow = await ctx.electronApp.browserWindow(ctx.mainWindow);
  return browserWindow.evaluate((win) => win.getTitle());
}

export async function isWindowVisible(ctx: AppContext): Promise<boolean> {
  const browserWindow = await ctx.electronApp.browserWindow(ctx.mainWindow);
  return browserWindow.evaluate((win) => win.isVisible());
}

export async function getWindowBounds(
  ctx: AppContext,
): Promise<{ x: number; y: number; width: number; height: number }> {
  const browserWindow = await ctx.electronApp.browserWindow(ctx.mainWindow);
  return browserWindow.evaluate((win) => win.getBounds());
}

export async function evaluateInMain<R>(
  ctx: AppContext,
  fn: (modules: {
    app: Electron.App;
    BrowserWindow: typeof Electron.BrowserWindow;
  }) => R | Promise<R>,
): Promise<R> {
  return ctx.electronApp.evaluate(fn as any);
}

export async function waitForAppReady(
  page: Page,
  timeout = 15_000,
): Promise<void> {
  await page
    .waitForSelector(".loading-spinner, .animate-spin", {
      state: "detached",
      timeout,
    })
    .catch(() => {});

  await page
    .waitForSelector("aside, main, nav, form", {
      state: "visible",
      timeout: 5_000,
    })
    .catch(() => {});
}

export async function takeDebugScreenshot(
  page: Page,
  name: string,
): Promise<void> {
  const screenshotDir = resolve(PROJECT_ROOT, "e2e/screenshots");
  await page.screenshot({
    path: resolve(screenshotDir, `${name}-${Date.now()}.png`),
    fullPage: true,
  });
}

export async function navigateTo(page: Page, route: string): Promise<void> {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  await page.evaluate((r) => {
    window.location.hash = `#${r}`;
  }, normalizedRoute);
  await page.waitForLoadState("domcontentloaded");
}
