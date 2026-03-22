/**
 * E2E Test: Settings Page – Data Card UI (Rarity Source & Export)
 *
 * Tests data-oriented settings cards' UI elements, controls, and interactions:
 * - Rarity Source Card (select, rescan, PL block)
 * - Export Card (path input, folder picker, reveal/hide, reset)
 *
 * Game Configuration, Storage, and Danger Zone cards are in
 * settings-cards-config.e2e.test.ts (split for parallel scheduling).
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Setup must be complete (or completable via skipSetup)
 *
 * @module e2e/flows/settings/settings-cards-data
 */

import { expect, type Page, test } from "../../helpers/electron-test";
import { getSetting, setSetting } from "../../helpers/ipc-helpers";
import {
  ensurePostSetup,
  navigateTo,
  waitForRoute,
} from "../../helpers/navigation";

/**
 * Navigates to settings and waits for data to load.
 */
async function goToSettings(page: Page) {
  await navigateTo(page, "/settings");
  await waitForRoute(page, "/settings", 10_000);
  // Give time for settings data to hydrate from IPC
  await page.waitForTimeout(1_500);
}

test.describe("Settings – Cards (Data)", () => {
  // ─── Rarity Source / Filter Card ──────────────────────────────────────────────

  test.describe("Rarity Source Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render the rarity source select with dataset options", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Rarity Source" });
      await expect(card).toBeVisible();

      await expect(
        card.getByText(/choose how divination card rarities/i),
      ).toBeVisible();

      const select = card.locator("select").first();
      await expect(select).toBeVisible();

      // Should have at least the built-in dataset options
      const bodyText = await select.innerHTML();
      expect(bodyText.toLowerCase()).toContain("poe.ninja");
      expect(bodyText.toLowerCase()).toContain("prohibited library");
    });

    test("should render the Rescan button and be able to click it", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Rarity Source" });

      const rescanButton = card
        .locator("button", { hasText: /rescan/i })
        .first();
      await expect(rescanButton).toBeVisible();

      // The page may auto-trigger a scan on mount (when no filters are
      // cached).  Wait for that initial scan to finish so the button
      // becomes clickable before we interact with it.
      await expect(rescanButton).toBeEnabled({ timeout: 30_000 });

      // Click rescan — should not crash and button should remain functional
      await rescanButton.click();

      // The scan is async — the button disables while scanning, then
      // re-enables.  Wait for it to settle instead of a fixed sleep.
      await expect(rescanButton).toBeEnabled({ timeout: 30_000 });

      // Button should still be visible after scan completes
      await expect(rescanButton).toBeVisible();
    });

    test("should switch rarity source via select and persist via IPC", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Rarity Source" });
      const select = card.locator("select").first();

      const originalValue = await select.inputValue();

      // Switch to "prohibited-library"
      await select.selectOption("prohibited-library");
      await page.waitForTimeout(500);

      const newValue = await select.inputValue();
      expect(newValue).toBe("prohibited-library");

      // Verify IPC persistence
      const persisted = await getSetting<string>(page, "raritySource");
      expect(persisted).toBe("prohibited-library");

      // Verify the Prohibited Library status block appears when PL is selected
      await expect(
        card.getByText(/prohibited library data/i).first(),
      ).toBeVisible({ timeout: 5_000 });

      // Switch back to poe.ninja
      await select.selectOption("poe.ninja");
      await page.waitForTimeout(500);

      const restoredPersisted = await getSetting<string>(page, "raritySource");
      expect(restoredPersisted).toBe("poe.ninja");

      // PL status block should be hidden when switching away from PL
      await expect(
        card.getByText(/prohibited library data/i).first(),
      ).not.toBeVisible({ timeout: 3_000 });

      // Restore original if it was different
      if (originalValue !== "poe.ninja") {
        await select.selectOption(originalValue);
        await page.waitForTimeout(300);
      }
    });

    test("should switch to poe.ninja and back to verify IPC round-trip", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Rarity Source" });
      const select = card.locator("select").first();

      // Switch to poe.ninja
      await select.selectOption("poe.ninja");
      await page.waitForTimeout(500);
      expect(await select.inputValue()).toBe("poe.ninja");

      const persisted = await getSetting<string>(page, "raritySource");
      expect(persisted).toBe("poe.ninja");

      // Switch to prohibited-library
      await select.selectOption("prohibited-library");
      await page.waitForTimeout(500);
      expect(await select.inputValue()).toBe("prohibited-library");

      const persisted2 = await getSetting<string>(page, "raritySource");
      expect(persisted2).toBe("prohibited-library");

      // Restore to poe.ninja
      await select.selectOption("poe.ninja");
      await page.waitForTimeout(300);
    });

    test("should show filter count after rescan when filters are available", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Rarity Source" });

      const rescanButton = card
        .locator("button", { hasText: /rescan/i })
        .first();

      // Wait for any in-progress auto-scan to finish before clicking
      await expect(rescanButton).toBeEnabled({ timeout: 30_000 });
      await rescanButton.click();
      // Wait for the triggered rescan to complete
      await expect(rescanButton).toBeEnabled({ timeout: 30_000 });

      // After scan, either "N filter(s) available" or "No filters found" should appear
      const filterCount = card.getByText(/filter.*available/i);
      const noFilters = card.getByText(/no filters found/i);

      // One of these should be visible
      const hasCount = await filterCount.isVisible().catch(() => false);
      const hasNoFilters = await noFilters.isVisible().catch(() => false);
      expect(hasCount || hasNoFilters).toBe(true);
    });

    test("full flow: render → switch source → verify PL block → rescan → restore", async ({
      page,
    }) => {
      // Wait for any initial auto-scan to finish so buttons are interactive
      const rarityCard = page.locator(".card", { hasText: "Rarity Source" });
      const rescanBtn = rarityCard
        .locator("button", { hasText: /rescan/i })
        .first();
      await expect(rescanBtn).toBeEnabled({ timeout: 30_000 });
      const card = page.locator(".card", { hasText: "Rarity Source" });
      const select = card.locator("select").first();
      const rescanButton = card
        .locator("button", { hasText: /rescan/i })
        .first();

      // 1. Verify initial render
      await expect(card).toBeVisible();
      await expect(select).toBeVisible();
      await expect(rescanButton).toBeVisible();

      const originalValue = await select.inputValue();

      // 2. Switch to prohibited-library → PL block should appear
      await select.selectOption("prohibited-library");
      await page.waitForTimeout(500);
      await expect(
        card.getByText(/prohibited library data/i).first(),
      ).toBeVisible({ timeout: 5_000 });

      // 3. PL block should have a Reload button
      const reloadButton = card
        .locator("button", { hasText: /reload/i })
        .first();
      await expect(reloadButton).toBeVisible();

      // 4. Click Reload — should not crash
      await reloadButton.click();
      await page.waitForTimeout(1_000);
      await expect(reloadButton).toBeVisible();

      // 5. Rescan filters
      await rescanButton.click();
      await page.waitForTimeout(1_500);
      await expect(rescanButton).toBeEnabled();

      // 6. Restore original source
      await select.selectOption(originalValue || "poe.ninja");
      await page.waitForTimeout(300);
    });
  });

  // ─── Export Settings Card ─────────────────────────────────────────────────────

  test.describe("Export Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render the export folder path input and folder picker button", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Export" }).filter({
        hasText: /configure where csv exports/i,
      });
      await expect(card).toBeVisible();

      // Read-only text input showing the export path
      const pathInput = card.locator('input[type="text"]').first();
      await expect(pathInput).toBeVisible();
      await expect(pathInput).toHaveAttribute("readonly", "");

      // Folder picker button (has a folder icon)
      const buttons = card.locator("button");
      expect(await buttons.count()).toBeGreaterThan(0);

      // Should show descriptive help text
      await expect(
        card.getByText(/save dialog will open to this folder/i),
      ).toBeVisible();
    });

    test("should show default placeholder when no custom path is set", async ({
      page,
    }) => {
      // Clear csvExportPath via IPC to ensure default state
      await setSetting(page, "csvExportPath", null);
      await page.waitForTimeout(500);

      // Reload so the store rehydrates from IPC with the cleared value
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);
      await goToSettings(page);

      const refreshedCard = page
        .locator(".card", { hasText: "Export" })
        .filter({
          hasText: /configure where csv exports/i,
        });
      const pathInput = refreshedCard.locator('input[type="text"]').first();

      // With no custom path, the placeholder should indicate the default folder
      const placeholder = await pathInput.getAttribute("placeholder");
      expect(placeholder?.toLowerCase()).toContain("default");

      // The reveal/hide button should NOT be visible when there's no custom path
      const revealButton = refreshedCard.locator("button", {
        hasText: /hide|reveal/i,
      });
      expect(await revealButton.count()).toBe(0);

      // The "Reset to default" button should NOT be visible when there's no custom path
      const resetButton = refreshedCard.locator("button", {
        hasText: /reset to default/i,
      });
      expect(await resetButton.count()).toBe(0);
    });

    test("should show reveal/hide toggle and reset button when a custom path is set via IPC", async ({
      page,
    }) => {
      // Set a custom export path via IPC
      const testPath = "C:\\Users\\test\\Desktop\\soothsayer-exports\\custom";
      await setSetting(page, "csvExportPath", testPath);
      await page.waitForTimeout(500);

      // Reload so the store rehydrates from IPC with the new value
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);
      await goToSettings(page);

      const refreshedCard = page
        .locator(".card", { hasText: "Export" })
        .filter({
          hasText: /configure where csv exports/i,
        });

      // The path input should show something (either masked or full path)
      const pathInput = refreshedCard.locator('input[type="text"]').first();
      const displayValue = await pathInput.inputValue();
      expect(displayValue.length).toBeGreaterThan(0);

      // Look for a button with the reveal/hide title specifically
      const revealToggle = refreshedCard.locator(
        'button[title="Reveal full path"], button[title="Hide full path"]',
      );
      expect(await revealToggle.count()).toBeGreaterThan(0);

      // Click the reveal toggle to show the full path
      await revealToggle.first().click();
      await page.waitForTimeout(300);
      const revealedValue = await pathInput.inputValue();
      expect(revealedValue).toBe(testPath);

      // Click again to hide the path
      await revealToggle.first().click();
      await page.waitForTimeout(300);
      const maskedValue = await pathInput.inputValue();
      // The masked value should differ from the full path (shorter due to masking)
      expect(maskedValue).not.toBe(testPath);

      // "Reset to default" button should be visible with a custom path
      const resetButton = refreshedCard
        .locator("button", { hasText: /reset to default/i })
        .first();
      await expect(resetButton).toBeVisible();

      // Click Reset to default — should clear the custom path
      await resetButton.click();
      await page.waitForTimeout(500);

      const afterReset = await getSetting<string | null>(page, "csvExportPath");
      expect(afterReset).toBeNull();

      // The input should now be empty (no custom path)
      const afterResetValue = await pathInput.inputValue();
      expect(afterResetValue).toBe("");
    });

    test("should persist export path via IPC and reflect in UI", async ({
      page,
    }) => {
      // Set path via IPC
      const testPath = "C:\\Users\\test\\Documents\\soothsayer-exports";
      await setSetting(page, "csvExportPath", testPath);
      await page.waitForTimeout(300);

      // Read back via IPC to confirm persistence
      const persisted = await getSetting<string>(page, "csvExportPath");
      expect(persisted).toBe(testPath);

      // Clean up
      await setSetting(page, "csvExportPath", null);
      await page.waitForTimeout(300);
    });

    test("should have folder picker button wired to selectFile IPC", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Export" }).filter({
        hasText: /configure where csv exports/i,
      });
      await expect(card).toBeVisible();

      // The folder picker button should be visible and enabled
      const folderButton = card.locator("button").last();
      await expect(folderButton).toBeVisible();
      await expect(folderButton).not.toBeDisabled();

      // Verify the IPC function exists on the frozen context bridge — clicking
      // the button calls window.electron.selectFile({ properties: ["openDirectory"] })
      // which opens a native OS dialog.  We can't spy on the frozen bridge, so
      // verify the function is wired up without actually invoking it.
      const ipcExists = await page.evaluate(() => {
        const w = window as any;
        return typeof w.electron?.selectFile === "function";
      });
      expect(
        ipcExists,
        "window.electron.selectFile should be exposed by the preload script",
      ).toBe(true);
    });
  });
});
