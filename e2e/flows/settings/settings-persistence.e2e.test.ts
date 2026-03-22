/**
 * E2E Test: Settings – IPC Persistence & Cross-Navigation
 *
 * Tests settings IPC round-trips and persistence across page navigations:
 * 1. Read/write all setting types (boolean, numeric, string) via IPC bridge
 * 2. Verify IPC-set values reflect in the UI after reload
 * 3. Verify settings persist when navigating away and back
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Setup must be complete (or completable via skipSetup)
 *
 * @module e2e/flows/settings/settings-persistence
 */

import { expect, type Page, test } from "../../helpers/electron-test";
import {
  getAllSettings,
  getSetting,
  setSetting,
} from "../../helpers/ipc-helpers";
import {
  clickSidebarLink,
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
  waitForRoute,
} from "../../helpers/navigation";

/**
 * Navigates to settings and waits for data to load.
 */
async function goToSettings(page: Page) {
  await navigateTo(page, "/settings");
  await waitForRoute(page, "/settings", 10_000);
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
}

test.describe("Settings", () => {
  // ─── IPC Persistence ──────────────────────────────────────────────────────────

  test.describe("IPC Persistence", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should be able to read all settings via IPC bridge", async ({
      page,
    }) => {
      const settings = await getAllSettings(page);

      expect(settings).not.toBeNull();
      expect(typeof settings).toBe("object");

      // Verify expected keys exist
      expect(settings).toHaveProperty("audioEnabled");
      expect(settings).toHaveProperty("selectedGame");
      expect(settings).toHaveProperty("appExitAction");
      expect(settings).toHaveProperty("telemetryCrashReporting");
      expect(settings).toHaveProperty("overlayFontSize");
    });

    test("should be able to read a specific boolean setting via IPC", async ({
      page,
    }) => {
      const value = await getSetting(page, "telemetryCrashReporting");

      // Value should be a boolean (or null in a fresh DB)
      expect(
        value === null || value === undefined || typeof value === "boolean",
      ).toBe(true);
    });

    test("should be able to read a specific string setting via IPC", async ({
      page,
    }) => {
      const value = await getSetting<string>(page, "selectedGame");

      expect(value === "poe1" || value === "poe2").toBe(true);
    });

    test("should persist a setting change via IPC and read it back", async ({
      page,
    }) => {
      // Read current value
      const original = await getSetting<boolean>(
        page,
        "telemetryUsageAnalytics",
      );
      const originalBool = typeof original === "boolean" ? original : false;

      // Toggle it
      const toggled = !originalBool;
      await setSetting(page, "telemetryUsageAnalytics", toggled);

      // Read it back
      const updated = await getSetting<boolean>(
        page,
        "telemetryUsageAnalytics",
      );
      expect(updated).toBe(toggled);
      expect(updated).not.toBe(originalBool);

      // Restore
      await setSetting(page, "telemetryUsageAnalytics", originalBool);
    });

    test("should persist a numeric setting via IPC", async ({ page }) => {
      const original = await getSetting<number>(page, "audioVolume");
      const originalNum = typeof original === "number" ? original : 0.5;

      await setSetting(page, "audioVolume", 0.42);

      const updated = await getSetting<number>(page, "audioVolume");
      expect(updated).toBeCloseTo(0.42, 2);

      // Restore
      await setSetting(page, "audioVolume", originalNum);
    });

    test("should persist a string setting via IPC", async ({ page }) => {
      const original = await getSetting<string>(page, "appExitAction");

      const newValue = original === "exit" ? "minimize" : "exit";
      await setSetting(page, "appExitAction", newValue);

      const updated = await getSetting<string>(page, "appExitAction");
      expect(updated).toBe(newValue);

      // Restore
      await setSetting(page, "appExitAction", original);
    });
  });

  // ─── UI ↔ IPC Round-Trip ─────────────────────────────────────────────────────

  test.describe("UI to IPC Round-Trip", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should reflect IPC-set value in the UI (audioEnabled toggle)", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Audio" }).filter({
        hasText: "Configure sounds for rare divination card drops",
      });
      const toggle = card
        .locator("label", { hasText: "Enable drop sounds" })
        .locator('input[type="checkbox"]');

      // Read the current UI state
      const uiState = await toggle.isChecked();

      // Set to opposite via IPC
      await setSetting(page, "audioEnabled", !uiState);

      // Reload so the store rehydrates from IPC with the updated value
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);
      await goToSettings(page);

      const card2 = page.locator(".card", { hasText: "Audio" }).filter({
        hasText: "Configure sounds for rare divination card drops",
      });
      const toggle2 = card2
        .locator("label", { hasText: "Enable drop sounds" })
        .locator('input[type="checkbox"]');
      const newUiState = await toggle2.isChecked();
      expect(newUiState).toBe(!uiState);

      // Restore
      await setSetting(page, "audioEnabled", uiState);
    });

    test("should reflect IPC-set value in the UI (appExitAction select)", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Application Behavior",
      });
      const select = card.locator("select").first();

      const uiValue = await select.inputValue();
      const newValue = uiValue === "exit" ? "minimize" : "exit";

      // Set via IPC
      await setSetting(page, "appExitAction", newValue);

      // Reload so the store rehydrates from IPC with the updated value
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);
      await goToSettings(page);

      const card2 = page.locator(".card", {
        hasText: "Application Behavior",
      });
      const select2 = card2.locator("select").first();
      expect(await select2.inputValue()).toBe(newValue);

      // Restore
      await setSetting(page, "appExitAction", uiValue);
    });
  });

  // ─── Cross-Navigation Persistence ─────────────────────────────────────────────

  test.describe("Cross-Navigation Persistence", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should preserve settings state when navigating away and back", async ({
      page,
    }) => {
      // Navigate to settings
      await goToSettings(page);

      // Change a setting via UI
      const card = page.locator(".card", {
        hasText: "Application Behavior",
      });
      const select = card.locator("select").first();
      const originalValue = await select.inputValue();
      const newValue = originalValue === "exit" ? "minimize" : "exit";
      await select.selectOption(newValue);
      await expect(select).toHaveValue(newValue, { timeout: 5_000 });

      // Navigate away to Cards
      await clickSidebarLink(page, "Cards");
      await waitForRoute(page, "/cards", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
      expect(await getCurrentRoute(page)).toBe("/cards");

      // Navigate back to Settings
      await navigateTo(page, "/settings");
      await waitForRoute(page, "/settings", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Verify the setting persisted
      const card2 = page.locator(".card", {
        hasText: "Application Behavior",
      });
      const select2 = card2.locator("select").first();
      expect(await select2.inputValue()).toBe(newValue);

      // Restore
      await select2.selectOption(originalValue);
      await expect(select2).toHaveValue(originalValue, { timeout: 5_000 });
    });

    test("should navigate fluently between settings and multiple other pages", async ({
      page,
    }) => {
      const routes = [
        "/settings",
        "/cards",
        "/sessions",
        "/settings",
        "/",
        "/settings",
      ];

      for (const route of routes) {
        if (route === "/") {
          await clickSidebarLink(page, "Current Session");
        } else if (route === "/cards") {
          await clickSidebarLink(page, "Cards");
        } else if (route === "/sessions") {
          await clickSidebarLink(page, "Sessions");
        } else {
          await navigateTo(page, route);
        }

        await waitForRoute(page, route, 10_000);

        const current = await getCurrentRoute(page);
        expect(current).toBe(route);

        // Verify the page didn't crash
        const main = page.locator("main");
        await expect(main).toBeVisible();
      }
    });

    test("should preserve a toggle change across navigation round-trip", async ({
      page,
    }) => {
      await goToSettings(page);

      // Toggle crash reporting
      const card = page.locator(".card", {
        hasText: "Privacy & Telemetry",
      });
      const toggle = card
        .locator("label", { hasText: "Crash Reporting" })
        .locator('input[type="checkbox"]');
      const original = await toggle.isChecked();

      const targetChecked = !original;
      await toggle.click({ force: true });
      if (targetChecked) {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      }

      // Navigate away
      await clickSidebarLink(page, "Current Session");
      await waitForRoute(page, "/", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Navigate back
      await navigateTo(page, "/settings");
      await waitForRoute(page, "/settings", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Check value persisted
      const card2 = page.locator(".card", {
        hasText: "Privacy & Telemetry",
      });
      const toggle2 = card2
        .locator("label", { hasText: "Crash Reporting" })
        .locator('input[type="checkbox"]');
      const afterNav = await toggle2.isChecked();
      expect(afterNav).not.toBe(original);

      // Restore
      await toggle2.click({ force: true });
      if (original) {
        await expect(toggle2).toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle2).not.toBeChecked({ timeout: 5_000 });
      }
    });
  });
});
