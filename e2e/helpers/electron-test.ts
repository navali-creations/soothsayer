import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  test as base,
  type ElectronApplication,
  _electron as electron,
  type Page,
} from "@playwright/test";

function resolveElectronPath(): string {
  try {
    const electronModule = require("electron") as string;
    if (typeof electronModule === "string" && fs.existsSync(electronModule)) {
      return electronModule;
    }
  } catch {
    // Fall through to manual resolution
  }

  const projectRoot = path.resolve(__dirname, "../..");
  const platform = process.platform;
  const binaryName: Record<string, string> = {
    win32: "electron.exe",
    darwin: "Electron.app/Contents/MacOS/Electron",
    linux: "electron",
  };

  const bin = binaryName[platform];
  if (!bin) {
    throw new Error(`Unsupported platform: "${platform}"`);
  }

  // Flat node_modules
  const flatPath = path.join(projectRoot, "node_modules/electron/dist", bin);
  if (fs.existsSync(flatPath)) {
    return flatPath;
  }

  // pnpm store — scan for any installed electron version
  const pnpmBase = path.join(projectRoot, "node_modules/.pnpm");
  if (fs.existsSync(pnpmBase)) {
    try {
      const match = fs
        .readdirSync(pnpmBase)
        .filter((e) => /^electron@\d+/.test(e))
        .sort()
        .reverse();

      for (const dir of match) {
        const candidate = path.join(
          pnpmBase,
          dir,
          "node_modules/electron/dist",
          bin,
        );
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch {
      // ignore
    }
  }

  throw new Error(
    `Could not resolve Electron binary for platform "${platform}". Ensure electron is installed.`,
  );
}

// ─── Slow-Mo Helper ───────────────────────────────────────────────────────────
//
// Playwright's `electron.launch()` does NOT support the `slowMo` option
// (that only works with `browserType.launch()`).  To get a visible delay
// between every interaction in Electron E2E tests we monkey-patch the
// **Locator prototype** so that `locator.click()`, `locator.fill()`, etc.
// are all preceded by a `page.waitForTimeout(ms)` pause.
//
// We obtain the Locator prototype at runtime from a real locator instance
// (there is no public export of the class).  This means every Locator
// created from the page — including chained ones like
// `page.locator("x").getByText("y").first()` — inherits the delay
// automatically, and `expect(locator).toBeVisible()` keeps working
// because we never replace the object identity.
//
// Activate via the SLOWMO env var (value is milliseconds):
//   SLOWMO=500 pnpm test:e2e:run --grep "AppMenu"

/** Locator methods that correspond to user-visible interactions. */
const LOCATOR_ACTIONS = [
  "click",
  "dblclick",
  "fill",
  "type",
  "press",
  "pressSequentially",
  "check",
  "uncheck",
  "selectOption",
  "setInputFiles",
  "hover",
  "tap",
  "dragAndDrop",
  "focus",
  "dispatchEvent",
  "clear",
  "setChecked",
  "selectText",
  "scrollIntoViewIfNeeded",
] as const;

/**
 * Monkey-patch the Locator prototype (obtained from a real locator) so
 * that every action method is preceded by a fixed delay.
 *
 * Returns a cleanup function that restores the original prototype methods.
 */
function applySlowMo(page: Page, delayMs: number): () => void {
  // Get the prototype from a throwaway locator — all locators produced by
  // this page share the same prototype object.
  const sampleLocator = page.locator("body");
  const proto = Object.getPrototypeOf(sampleLocator);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const originals = new Map<string, (...args: any[]) => any>();

  for (const method of LOCATOR_ACTIONS) {
    const original = proto[method];
    if (typeof original !== "function") continue;

    originals.set(method, original);

    proto[method] = async function slowMoLocatorAction(
      this: typeof sampleLocator,
      ...args: unknown[]
    ): Promise<unknown> {
      await page.waitForTimeout(delayMs);
      return original.apply(this, args);
    };
  }

  // Return a teardown that restores the prototype
  return () => {
    for (const [method, original] of originals) {
      proto[method] = original;
    }
    originals.clear();
  };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

export interface ElectronTestOptions {
  electronArgs: string[];
  electronEnv: Record<string, string>;
  firstWindowTimeout: number;
}

export const test = base.extend<
  // Test-scoped fixtures: app & page are forwarded from worker scope
  { app: ElectronApplication; page: Page },
  // Worker-scoped fixtures & options
  {
    workerApp: ElectronApplication;
    workerPage: Page;
    electronArgs: string[];
    electronEnv: Record<string, string>;
    firstWindowTimeout: number;
  }
>({
  // --- Worker-scoped options ---
  electronArgs: [[], { option: true, scope: "worker" }],
  electronEnv: [{}, { option: true, scope: "worker" }],
  firstWindowTimeout: [30_000, { option: true, scope: "worker" }],

  // --- Worker-scoped fixtures ---
  workerApp: [
    async ({ electronArgs, electronEnv }, use) => {
      const projectRoot = path.resolve(__dirname, "../..");
      const mainEntry = path.join(projectRoot, ".vite/build/main.js");

      if (!fs.existsSync(mainEntry)) {
        throw new Error(
          `Electron main entry not found at "${mainEntry}". ` +
            "Run `pnpm start` once to let Vite compile, then stop and run E2E tests.",
        );
      }

      const executablePath = resolveElectronPath();

      // Each worker gets its own isolated user-data directory to avoid
      // SQLite / settings conflicts when running tests in parallel.
      const userData = path.join(
        os.tmpdir(),
        `soothsayer-e2e-${crypto.randomUUID()}`,
      );
      fs.mkdirSync(userData, { recursive: true });

      // On CI (GitHub Actions), Electron needs --no-sandbox because the
      // runner's kernel doesn't grant the unprivileged user-namespace
      // capabilities that Chromium's sandbox requires.  Without it the
      // process exits before printing the DevTools WebSocket URL and
      // Playwright throws "Process failed to launch!".
      //
      // --disable-gpu avoids GPU-process crashes under xvfb software
      // rendering.  The ELECTRON_DISABLE_GPU env var is not always
      // sufficient, so we pass the flag explicitly as well.
      const ciArgs: string[] = process.env.CI
        ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
        : [];

      const electronApp = await electron.launch({
        executablePath,
        args: [
          mainEntry,
          `--user-data-dir=${userData}`,
          ...ciArgs,
          ...electronArgs,
        ],
        env: {
          ...process.env,
          NODE_ENV: "test",
          E2E_TESTING: "true",
          ELECTRON_DISABLE_GPU: "true",
          ...electronEnv,
        },
        timeout: 30_000,
      });

      await use(electronApp);

      // Teardown: close app then clean up temp user-data dir
      try {
        await electronApp.close();
      } catch {
        // App may have already been closed by the test
      }

      try {
        fs.rmSync(userData, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup
      }
    },
    { scope: "worker" },
  ],

  workerPage: [
    async ({ workerApp, firstWindowTimeout }, use) => {
      const window = await workerApp.firstWindow();
      await window.waitForLoadState("domcontentloaded", {
        timeout: firstWindowTimeout,
      });
      await use(window);
    },
    { scope: "worker" },
  ],

  // --- Test-scoped fixtures ---
  //
  // Forward worker-scoped fixtures to test-scoped names so existing
  // tests that destructure `{ app, page }` keep working unchanged.
  //
  // There is NO auto-use resetPage fixture here on purpose.
  // Each test file manages its own state via beforeEach hooks
  // (e.g. ensurePostSetup, mockSetupComplete, waitForHydration).
  // An auto-reset would conflict with setup-wizard tests that need
  // the app in an incomplete-setup state, and with serial test suites
  // that build on prior-test side effects.

  app: async ({ workerApp }, use) => {
    await use(workerApp);
  },

  page: async ({ workerPage }, use) => {
    const slowMo = Number(process.env.SLOWMO) || 0;

    if (slowMo > 0) {
      console.log(`[SlowMo] ${slowMo}ms delay before every page action`);
      const teardown = applySlowMo(workerPage, slowMo);
      await use(workerPage);
      teardown();
    } else {
      await use(workerPage);
    }
  },
});

export { expect } from "@playwright/test";

export type { ElectronApplication, Page };
