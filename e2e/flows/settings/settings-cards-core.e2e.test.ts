/**
 * E2E Test: Settings Page – Card Rendering & Core Card UI
 *
 * Tests core settings cards' UI elements, controls, and interactions:
 * - All Cards Render (page header, card headings, interactive controls)
 * - Application Behavior Card (select, toggles)
 * - Overlay Card (sliders, restore defaults)
 * - Privacy & Telemetry Card (toggles, privacy policy link)
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Setup must be complete (or completable via skipSetup)
 *
 * @module e2e/flows/settings/settings-cards-core
 */

import type { Locator } from "@playwright/test";

import { expect, type Page, test } from "../../helpers/electron-test";
import { getSetting } from "../../helpers/ipc-helpers";
import {
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

/** Set a range input's value via JS and dispatch change event (bypasses visibility check). */
async function setRangeValue(locator: Locator, value: string) {
  await locator.evaluate((el, val) => {
    const input = el as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!;
    nativeSetter.call(input, val);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

test.describe("Settings – Cards (Core)", () => {
  // ─── All Cards Render ─────────────────────────────────────────────────────────

  test.describe("All Cards Render", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should display the page header", async ({ page }) => {
      await expect(
        page.locator("main h1", { hasText: "Settings" }),
      ).toBeVisible();
      await expect(
        page.getByText(/configure your application preferences/i),
      ).toBeVisible();
    });

    test("should render all expected settings card headings", async ({
      page,
    }) => {
      const expectedCards = [
        "Game Configuration",
        "Application Behavior",
        "Audio",
        "Overlay",
        "Privacy & Telemetry",
        "Rarity Source",
        "Export",
        "Storage",
        "App Help",
        "Danger Zone",
      ];

      for (const cardTitle of expectedCards) {
        const heading = page.getByText(cardTitle, { exact: false }).first();
        await expect(heading).toBeVisible({ timeout: 5_000 });
      }
    });

    test("should have multiple interactive controls on the page", async ({
      page,
    }) => {
      const controls = page.locator(
        'main input, main select, main [role="switch"], main [role="checkbox"]',
      );
      // There are toggles, sliders, selects, text inputs — expect many
      await expect(controls.nth(7)).toBeVisible({ timeout: 5_000 });
    });
  });

  // ─── Application Behavior Card ────────────────────────────────────────────────

  test.describe("Application Behavior Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render 'When closing the window' select with correct options", async ({
      page,
    }) => {
      const label = page.getByText("When closing the window");
      await expect(label).toBeVisible();

      // Find the select near this label — it's inside the same card
      const card = page.locator(".card", {
        hasText: "Application Behavior",
      });
      const select = card.locator("select").first();
      await expect(select).toBeVisible();

      // Verify both options exist
      const options = select.locator("option");
      const optionTexts: string[] = [];
      for (let i = 0; i < (await options.count()); i++) {
        optionTexts.push((await options.nth(i).textContent()) ?? "");
      }
      expect(optionTexts).toContain("Exit Application");
      expect(optionTexts).toContain("Minimize to Tray");
    });

    test("should toggle the 'When closing the window' select", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Application Behavior",
      });
      const select = card.locator("select").first();

      const originalValue = await select.inputValue();
      const newValue = originalValue === "exit" ? "minimize" : "exit";

      await select.selectOption(newValue);
      await expect(select).toHaveValue(newValue, { timeout: 5_000 });

      // Verify IPC persistence
      const persisted = await getSetting<string>(page, "appExitAction");
      expect(persisted).toBe(newValue);

      // Restore original
      await select.selectOption(originalValue);
      await expect(select).toHaveValue(originalValue, { timeout: 5_000 });
    });

    test("should toggle 'Launch on startup' checkbox", async ({ page }) => {
      const card = page.locator(".card", {
        hasText: "Application Behavior",
      });

      // Find the toggle next to "Launch on startup"
      const label = card.getByText("Launch on startup");
      await expect(label).toBeVisible();

      const toggle = card
        .locator("label", { hasText: "Launch on startup" })
        .locator('input[type="checkbox"]');
      await expect(toggle).toBeVisible();

      const wasChecked = await toggle.isChecked();
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      }

      const isNowChecked = await toggle.isChecked();
      expect(isNowChecked).not.toBe(wasChecked);

      // Verify IPC persistence
      const persisted = await getSetting<boolean>(page, "appOpenAtLogin");
      expect(persisted).toBe(isNowChecked);

      // Restore
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      }
    });

    test("should toggle 'Start minimized' checkbox", async ({ page }) => {
      const card = page.locator(".card", {
        hasText: "Application Behavior",
      });

      const toggle = card
        .locator("label", { hasText: "Start minimized" })
        .locator('input[type="checkbox"]');
      await expect(toggle).toBeVisible();

      const wasChecked = await toggle.isChecked();
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      }

      const isNowChecked = await toggle.isChecked();
      expect(isNowChecked).not.toBe(wasChecked);

      // Verify IPC persistence
      const persisted = await getSetting<boolean>(
        page,
        "appOpenAtLoginMinimized",
      );
      expect(persisted).toBe(isNowChecked);

      // Restore
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      }
    });
  });

  // ─── Overlay Settings Card ────────────────────────────────────────────────────

  test.describe("Overlay Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render all 4 overlay sliders", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Overlay" }).filter({
        hasText: "Customize the overlay appearance and position",
      });
      await expect(card).toBeVisible();

      // Width slider
      await expect(card.getByText("Width")).toBeVisible();
      // Height slider
      await expect(card.getByText("Height", { exact: true })).toBeVisible();
      // Drop size slider
      await expect(card.getByText("Drop size")).toBeVisible();
      // Toolbar slider
      await expect(card.getByText("Toolbar")).toBeVisible();

      // 4 range inputs total
      const sliders = card.locator('input[type="range"]');
      await expect(sliders).toHaveCount(4, { timeout: 5_000 });
    });

    test("should adjust the overlay width slider", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Overlay" }).filter({
        hasText: "Customize the overlay appearance and position",
      });

      // The width slider is the first range input
      const widthSlider = card.locator('input[type="range"]').first();
      const originalValue = await widthSlider.inputValue();

      await setRangeValue(widthSlider, "350");
      await expect(card.getByText("350px")).toBeVisible({ timeout: 5_000 });

      const newValue = await widthSlider.inputValue();
      expect(newValue).toBe("350");

      // Restore
      await setRangeValue(widthSlider, originalValue);
    });

    test("should adjust the overlay height slider", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Overlay" }).filter({
        hasText: "Customize the overlay appearance and position",
      });

      // Height slider is the 2nd range input
      const heightSlider = card.locator('input[type="range"]').nth(1);
      const originalValue = await heightSlider.inputValue();

      await setRangeValue(heightSlider, "300");
      await expect(card.getByText("300px")).toBeVisible({ timeout: 5_000 });

      expect(await heightSlider.inputValue()).toBe("300");

      // Restore
      await setRangeValue(heightSlider, originalValue);
    });

    test("should adjust the drop size (font size) slider", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Overlay" }).filter({
        hasText: "Customize the overlay appearance and position",
      });

      // Drop size slider is the 3rd range input
      const fontSlider = card.locator('input[type="range"]').nth(2);
      const originalValue = await fontSlider.inputValue();

      await setRangeValue(fontSlider, "1.5");
      await expect(card.getByText("150%").first()).toBeVisible({
        timeout: 5_000,
      });

      expect(await fontSlider.inputValue()).toBe("1.5");

      // Verify IPC persistence
      const persisted = await getSetting<number>(page, "overlayFontSize");
      expect(persisted).toBeCloseTo(1.5, 1);

      // Restore
      await setRangeValue(fontSlider, originalValue);
    });

    test("should adjust the toolbar font size slider", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Overlay" }).filter({
        hasText: "Customize the overlay appearance and position",
      });

      // Toolbar slider is the 4th range input
      const toolbarSlider = card.locator('input[type="range"]').nth(3);
      const originalValue = await toolbarSlider.inputValue();

      await setRangeValue(toolbarSlider, "1.2");

      expect(await toolbarSlider.inputValue()).toBe("1.2");

      // Verify IPC persistence
      const persisted = await getSetting<number>(
        page,
        "overlayToolbarFontSize",
      );
      expect(persisted).toBeCloseTo(1.2, 1);

      // Restore
      await setRangeValue(toolbarSlider, originalValue);
    });

    test("should render and be able to click 'Restore defaults' button", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Overlay" }).filter({
        hasText: "Customize the overlay appearance and position",
      });

      const restoreButton = card
        .locator("button", { hasText: /restore defaults/i })
        .first();
      await expect(restoreButton).toBeVisible();

      // Change a slider first so we can verify restore
      const fontSlider = card.locator('input[type="range"]').nth(2);
      await setRangeValue(fontSlider, "1.8");
      await expect(card.getByText("180%").first()).toBeVisible({
        timeout: 5_000,
      });

      // Click restore
      await restoreButton.click();

      // Font size should be back to 1.0 (100%)
      const persisted = await getSetting<number>(page, "overlayFontSize");
      expect(persisted).toBeCloseTo(1.0, 1);
    });
  });

  // ─── Privacy & Telemetry Card ─────────────────────────────────────────────────

  test.describe("Privacy & Telemetry Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render both privacy toggles and the restart warning", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Privacy & Telemetry",
      });
      await expect(card).toBeVisible();

      await expect(card.getByText("Crash Reporting")).toBeVisible();
      await expect(card.getByText("Usage Analytics")).toBeVisible();

      // Restart warning
      await expect(
        card.getByText(/changes take effect after restarting/i),
      ).toBeVisible();

      // Privacy Policy link
      await expect(
        card.locator("a", { hasText: /view/i }).first(),
      ).toBeVisible();
    });

    test("should toggle 'Crash Reporting' and persist via IPC", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Privacy & Telemetry",
      });

      const toggle = card
        .locator("label", { hasText: "Crash Reporting" })
        .locator('input[type="checkbox"]');
      await expect(toggle).toBeVisible();

      const wasChecked = await toggle.isChecked();
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      }

      const isNowChecked = await toggle.isChecked();
      expect(isNowChecked).not.toBe(wasChecked);

      const persisted = await getSetting<boolean>(
        page,
        "telemetryCrashReporting",
      );
      expect(persisted).toBe(isNowChecked);

      // Restore
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      }
    });

    test("should toggle 'Usage Analytics' and persist via IPC", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Privacy & Telemetry",
      });

      const toggle = card
        .locator("label", { hasText: "Usage Analytics" })
        .locator('input[type="checkbox"]');
      await expect(toggle).toBeVisible();

      const wasChecked = await toggle.isChecked();
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      }

      const isNowChecked = await toggle.isChecked();
      expect(isNowChecked).not.toBe(wasChecked);

      const persisted = await getSetting<boolean>(
        page,
        "telemetryUsageAnalytics",
      );
      expect(persisted).toBe(isNowChecked);

      // Restore
      await toggle.click({ force: true });
      if (wasChecked) {
        await expect(toggle).toBeChecked({ timeout: 5_000 });
      } else {
        await expect(toggle).not.toBeChecked({ timeout: 5_000 });
      }
    });

    test("should navigate to Privacy Policy page via the View link", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Privacy & Telemetry",
      });

      const viewLink = card.locator("a", { hasText: /view/i }).first();
      await viewLink.click();
      await waitForRoute(page, "/privacy-policy", 10_000);

      const route = await getCurrentRoute(page);
      expect(route).toBe("/privacy-policy");
    });
  });
});
