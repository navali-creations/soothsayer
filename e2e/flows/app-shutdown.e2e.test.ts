/**
 * E2E App Shutdown Tests
 *
 * Verifies that closing the Electron app tears down the main process and its
 * child processes. A leftover process here usually means shutdown cleanup did
 * not finish or a child process survived app close.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  type ElectronApplication,
  _electron as electron,
  expect,
  test,
} from "@playwright/test";

import { resolveElectronPath } from "../helpers/electron-test";
import { waitForHydration } from "../helpers/navigation";
import {
  formatProcessList,
  getProcessTree,
  waitForProcessesToExit,
} from "../helpers/processes";

// This spec intentionally avoids the shared electron-test `{ app, page }`
// fixture. That fixture is worker-scoped, so closing it in this file can break
// the next test file scheduled onto the same Playwright worker.
async function launchIsolatedApp(): Promise<{
  app: ElectronApplication;
  userData: string;
}> {
  const projectRoot = path.resolve(__dirname, "../..");
  const mainEntry = path.join(projectRoot, ".vite/build/main.js");

  if (!fs.existsSync(mainEntry)) {
    throw new Error(
      `Electron main entry not found at "${mainEntry}". ` +
        "Run `node scripts/build-e2e.mjs` before E2E tests.",
    );
  }

  const userData = path.join(
    os.tmpdir(),
    `soothsayer-e2e-shutdown-${crypto.randomUUID()}`,
  );
  fs.mkdirSync(userData, { recursive: true });

  const ciArgs: string[] = process.env.CI
    ? ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"]
    : [];

  const app = await electron.launch({
    executablePath: resolveElectronPath(),
    args: [mainEntry, `--user-data-dir=${userData}`, ...ciArgs],
    env: {
      ...process.env,
      NODE_ENV: "test",
      E2E_TESTING: "true",
      ELECTRON_DISABLE_GPU: "true",
    },
    timeout: 30_000,
  });

  return { app, userData };
}

test.describe("App Shutdown", () => {
  test("should not leave app processes after close", async () => {
    test.setTimeout(60_000);

    const { app, userData } = await launchIsolatedApp();

    try {
      const page = await app.firstWindow();
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
      await waitForHydration(page);

      const rootPid = app.process()?.pid;
      if (!rootPid) {
        throw new Error("Could not resolve Electron main process PID");
      }

      const processTree = await getProcessTree(rootPid);
      const trackedPids = [
        ...new Set([
          rootPid,
          ...processTree.map((processInfo) => processInfo.pid),
        ]),
      ];

      expect(trackedPids.length).toBeGreaterThan(0);

      await app.close();

      const liveProcesses = await waitForProcessesToExit(trackedPids, {
        timeoutMs: 12_000,
      });

      expect(
        liveProcesses,
        `Expected all app processes to exit after app.close(). Still alive:\n${formatProcessList(
          liveProcesses,
        )}`,
      ).toHaveLength(0);
    } finally {
      await app.close().catch(() => {});
      fs.rmSync(userData, { recursive: true, force: true });
    }
  });
});
