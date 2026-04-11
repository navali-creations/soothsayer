/**
 * E2E Overlay Helpers
 *
 * Shared utilities for testing overlay show/hide behaviour.
 *
 * @module e2e/helpers/overlay
 */

import type { Page } from "@playwright/test";

import { callElectronAPI } from "./ipc-helpers";

/**
 * Polls `overlay.isVisible` until it matches the expected state, or throws
 * after the timeout. This replaces blind `waitForTimeout` calls after
 * show / hide / toggle operations.
 */
export async function waitForOverlayState(
  page: Page,
  expectedVisible: boolean,
  timeout = 5_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const isVisible = await callElectronAPI<boolean>(
      page,
      "overlay",
      "isVisible",
    );
    if (isVisible === expectedVisible) return;
    await page.waitForTimeout(100);
  }
  throw new Error(
    `Overlay did not become ${
      expectedVisible ? "visible" : "hidden"
    } within ${timeout}ms`,
  );
}

/**
 * Ensures the overlay is hidden before a test begins. Best-effort: if
 * `overlay.hide()` throws (e.g. overlay window was never created), we
 * swallow the error because the overlay is already in the desired state.
 */
export async function ensureOverlayHidden(page: Page) {
  try {
    const isVisible = await callElectronAPI<boolean>(
      page,
      "overlay",
      "isVisible",
    );
    if (isVisible) {
      await callElectronAPI(page, "overlay", "hide");
      await waitForOverlayState(page, false);
    }
  } catch {
    // Overlay may not have been created yet — that's fine
  }
}
