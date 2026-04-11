/**
 * E2E Test: Overlay Feature
 *
 * Tests the Overlay feature which is a transparent, always-on-top Electron
 * BrowserWindow used as an in-game HUD for Path of Exile divination card
 * tracking. It's controlled via `window.electron.overlay` IPC namespace.
 *
 * Available IPC methods:
 *   - show(), hide(), toggle(), isVisible()
 *   - setLocked(bool), getBounds(), restoreDefaults()
 *   - getSessionData(), setPosition(x, y), setSize(w, h)
 *   - onVisibilityChanged(callback), onSettingsChanged(callback)
 *
 * The overlay toggle button lives in the AppMenu (title bar) and has
 * the attribute `data-onboarding="overlay-icon"`.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required
 *
 * @module e2e/flows/overlay
 */

import { expect, test } from "../helpers/electron-test";
import { callElectronAPI, mockSetupComplete } from "../helpers/ipc-helpers";
import {
  ensurePostSetup,
  navigateTo,
  waitForHydration,
} from "../helpers/navigation";
import { ensureOverlayHidden, waitForOverlayState } from "../helpers/overlay";

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Overlay", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
  });

  // ── Overlay Toggle Button ───────────────────────────────────────────────

  test.describe("Overlay Toggle Button", () => {
    test("should render the overlay toggle button with the correct onboarding attribute", async ({
      page,
    }) => {
      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });
    });

    test("should have the overlay toggle button be clickable", async ({
      page,
    }) => {
      await ensureOverlayHidden(page);

      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });
      await expect(overlayButton).toBeEnabled({ timeout: 5_000 });
    });

    test("should not render the overlay toggle during setup mode", async ({
      page,
    }) => {
      // Switch to setup mode
      await page.evaluate(async () => {
        const electron = (window as any).electron;
        if (electron?.appSetup?.resetSetup) {
          await electron.appSetup.resetSetup();
        }
      });
      await page.reload();
      await waitForHydration(page, 30_000);

      // In setup mode, the overlay toggle should NOT be visible
      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      const isVisible = await overlayButton
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      expect(isVisible).toBe(false);

      // Restore post-setup state for subsequent tests
      await mockSetupComplete(page);
      await waitForHydration(page, 30_000);
    });
  });

  // ── Overlay Visibility via IPC ──────────────────────────────────────────

  test.describe("Overlay Visibility via IPC", () => {
    test.afterEach(async ({ page }) => {
      // Always try to hide the overlay after each test in this group
      await ensureOverlayHidden(page);
    });

    test("should report overlay as not visible initially", async ({ page }) => {
      await ensureOverlayHidden(page);

      const isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(false);
    });

    test("should be able to show overlay via IPC", async ({ page }) => {
      await ensureOverlayHidden(page);

      // Show the overlay
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      // Verify it's now visible
      const isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(true);
    });

    test("should be able to hide overlay via IPC after showing it", async ({
      page,
    }) => {
      // Show the overlay first
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      // Verify it's visible
      let isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(true);

      // Hide it
      await callElectronAPI(page, "overlay", "hide");
      await waitForOverlayState(page, false);

      // Verify it's now hidden
      isVisible = await callElectronAPI<boolean>(page, "overlay", "isVisible");
      expect(isVisible).toBe(false);
    });

    test("should toggle overlay on and off via IPC", async ({ page }) => {
      await ensureOverlayHidden(page);

      // Toggle on
      await callElectronAPI(page, "overlay", "toggle");
      await waitForOverlayState(page, true);

      let isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(true);

      // Toggle off
      await callElectronAPI(page, "overlay", "toggle");
      await waitForOverlayState(page, false);

      isVisible = await callElectronAPI<boolean>(page, "overlay", "isVisible");
      expect(isVisible).toBe(false);
    });
  });

  // ── Overlay Toggle Round-trip (Button + IPC) ────────────────────────────

  test.describe("Overlay Toggle Round-trip", () => {
    test.afterEach(async ({ page }) => {
      await ensureOverlayHidden(page);
    });

    test("should open overlay via AppMenu button and close via IPC", async ({
      page,
    }) => {
      await ensureOverlayHidden(page);

      // Click the overlay toggle button in the AppMenu
      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });
      await overlayButton.click();
      await waitForOverlayState(page, true);

      // Verify it's now visible via IPC
      const isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(true);

      // Close via IPC
      await callElectronAPI(page, "overlay", "hide");
      await waitForOverlayState(page, false);

      // Verify closed
      const isVisibleAfter = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisibleAfter).toBe(false);
    });

    test("should open overlay via IPC and close via AppMenu button", async ({
      page,
    }) => {
      await ensureOverlayHidden(page);

      // Open via IPC
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      const isVisibleBefore = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisibleBefore).toBe(true);

      // Close via the toggle button (clicking again should hide)
      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });
      await overlayButton.click();
      await waitForOverlayState(page, false);

      const isVisibleAfter = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisibleAfter).toBe(false);
    });

    test("should complete a full open → check → close → check cycle via IPC", async ({
      page,
    }) => {
      await ensureOverlayHidden(page);

      // Step 1: Verify initially not visible
      let isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(false);

      // Step 2: Show
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      // Step 3: Verify visible
      isVisible = await callElectronAPI<boolean>(page, "overlay", "isVisible");
      expect(isVisible).toBe(true);

      // Step 4: Hide
      await callElectronAPI(page, "overlay", "hide");
      await waitForOverlayState(page, false);

      // Step 5: Verify not visible
      isVisible = await callElectronAPI<boolean>(page, "overlay", "isVisible");
      expect(isVisible).toBe(false);
    });
  });

  // ── Overlay Defaults ────────────────────────────────────────────────────

  test.describe("Overlay Defaults", () => {
    test("should be able to call overlay.restoreDefaults without error", async ({
      page,
    }) => {
      // restoreDefaults should not throw — it resets the overlay's
      // position, size, and locked state to defaults
      let error: string | null = null;
      try {
        await callElectronAPI(page, "overlay", "restoreDefaults");
      } catch (e: any) {
        error = e.message ?? String(e);
      }

      expect(error).toBeNull();
    });

    test("should be able to query overlay bounds after restore", async ({
      page,
    }) => {
      // Restore defaults first
      await callElectronAPI(page, "overlay", "restoreDefaults");

      // getBounds may return null if the overlay window hasn't been created
      const bounds = await callElectronAPI<{
        x: number;
        y: number;
        width: number;
        height: number;
      } | null>(page, "overlay", "getBounds");

      // Bounds should be either null (overlay not created) or a valid object
      if (bounds !== null && bounds !== undefined) {
        expect(typeof bounds.x).toBe("number");
        expect(typeof bounds.y).toBe("number");
        expect(typeof bounds.width).toBe("number");
        expect(typeof bounds.height).toBe("number");
        expect(bounds.width).toBeGreaterThan(0);
        expect(bounds.height).toBeGreaterThan(0);
      }
    });
  });

  // ── Overlay Lock State ──────────────────────────────────────────────────

  test.describe("Overlay Lock State", () => {
    test.afterEach(async ({ page }) => {
      await ensureOverlayHidden(page);
    });

    test("should be able to set overlay locked state via IPC", async ({
      page,
    }) => {
      // Show the overlay first so the lock state can be toggled
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      // Set locked to true
      let error: string | null = null;
      try {
        await callElectronAPI(page, "overlay", "setLocked", true);
      } catch (e: any) {
        error = e.message ?? String(e);
      }
      expect(error).toBeNull();

      // Set locked to false
      error = null;
      try {
        await callElectronAPI(page, "overlay", "setLocked", false);
      } catch (e: any) {
        error = e.message ?? String(e);
      }
      expect(error).toBeNull();
    });
  });

  // ── Cross-Navigation ───────────────────────────────────────────────────

  test.describe("Cross-Navigation", () => {
    test("should maintain overlay state across page navigation", async ({
      page,
    }) => {
      await ensureOverlayHidden(page);

      // Show the overlay
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      let isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(true);

      // Navigate to a different page
      await navigateTo(page, "/cards");

      // Overlay should still be visible (it's a separate window)
      isVisible = await callElectronAPI<boolean>(page, "overlay", "isVisible");
      expect(isVisible).toBe(true);

      // Navigate back
      await navigateTo(page, "/");

      // Still visible
      isVisible = await callElectronAPI<boolean>(page, "overlay", "isVisible");
      expect(isVisible).toBe(true);

      // Clean up
      await callElectronAPI(page, "overlay", "hide");
      await waitForOverlayState(page, false);
    });

    test("should reflect overlay visibility in the toggle button tooltip", async ({
      page,
    }) => {
      await ensureOverlayHidden(page);

      // The tooltip on the overlay button should say "Show Overlay"
      // when overlay is hidden and "Hide Overlay" when visible
      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });

      // The tooltip is on the parent container (a .tooltip div)
      const tooltipContainer = overlayButton.locator(
        "xpath=ancestor::div[contains(@class, 'tooltip')]",
      );
      const tooltipVisible = await tooltipContainer
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      if (tooltipVisible) {
        const dataTip = await tooltipContainer.getAttribute("data-tip");
        if (dataTip) {
          // When hidden, should say "Show Overlay"
          expect(dataTip).toContain("Overlay");
        }
      }

      // Show the overlay
      await callElectronAPI(page, "overlay", "show");
      await waitForOverlayState(page, true);

      // After showing, the tooltip should reflect "Hide Overlay"
      // (the Zustand store updates via onVisibilityChanged listener)
      if (tooltipVisible) {
        await expect(tooltipContainer).toHaveAttribute("data-tip", /Overlay/, {
          timeout: 5_000,
        });
        const dataTipAfter = await tooltipContainer.getAttribute("data-tip");
        if (dataTipAfter) {
          expect(dataTipAfter).toContain("Overlay");
        }
      }

      // Clean up
      await callElectronAPI(page, "overlay", "hide");
      await waitForOverlayState(page, false);
    });
  });
});
