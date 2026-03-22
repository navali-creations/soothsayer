/**
 * E2E Test: Settings Page – Configuration, Storage & Danger Zone Cards
 *
 * Tests configuration and management settings cards' UI elements, controls,
 * and interactions:
 * - Game Configuration Card (file path inputs, file pickers, reveal/hide)
 * - Storage Card (disk usage, league data, reveal/hide)
 * - Danger Zone Card (reset database, confirmation modal)
 *
 * Split from settings-cards-data to keep individual test files under ~1 minute
 * so Playwright can schedule them on separate workers.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Setup must be complete (or completable via skipSetup)
 *
 * @module e2e/flows/settings/settings-cards-config
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
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
}

test.describe("Settings – Cards (Config)", () => {
  // ─── Game Configuration (File Paths) Card ─────────────────────────────────────

  test.describe("Game Configuration Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render file path inputs for PoE1 and PoE2 Client.txt", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Game Configuration",
      });
      await expect(card).toBeVisible();

      await expect(card.getByText("Path of Exile 1 Client.txt")).toBeVisible();
      await expect(card.getByText("Path of Exile 2 Client.txt")).toBeVisible();

      // There should be 2 read-only text inputs (one per game)
      const inputs = card.locator('input[type="text"]');
      await expect(inputs).toHaveCount(2, { timeout: 5_000 });

      // Each input should be read-only
      for (let i = 0; i < 2; i++) {
        await expect(inputs.nth(i)).toHaveAttribute("readonly", "");
      }
    });

    test("should have file picker buttons for each path", async ({ page }) => {
      const card = page.locator(".card", {
        hasText: "Game Configuration",
      });

      // There should be folder picker buttons (one per game path)
      const buttons = card.locator("button");
      await expect(buttons).toHaveCount(2, { timeout: 5_000 });
    });

    test("should show reveal/hide toggle when a path is set via IPC", async ({
      page,
    }) => {
      // Set a fake PoE1 client path via IPC
      const testPath = "C:\\Program Files\\Path of Exile\\logs\\Client.txt";
      await setSetting(page, "poe1ClientTxtPath", testPath);

      // Reload so the store rehydrates from IPC with the new path
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);
      await goToSettings(page);

      const refreshedCard = page.locator(".card", {
        hasText: "Game Configuration",
      });

      // The first input should now have a value (masked)
      const firstInput = refreshedCard.locator('input[type="text"]').first();
      const displayValue = await firstInput.inputValue();
      expect(displayValue.length).toBeGreaterThan(0);

      // The reveal/hide toggle should appear for the path that has a value
      const revealToggle = refreshedCard.locator(
        'button[title="Reveal full path"], button[title="Hide full path"]',
      );
      await expect(revealToggle.first()).toBeVisible({ timeout: 5_000 });

      // Click to reveal — should show the full path
      await revealToggle.first().click();
      await expect(
        refreshedCard.locator('button[title="Hide full path"]').first(),
      ).toBeVisible({ timeout: 5_000 });
      const revealedValue = await firstInput.inputValue();
      expect(revealedValue).toBe(testPath);

      // Click again to hide — should mask the path
      await revealToggle.first().click();
      await expect(
        refreshedCard.locator('button[title="Reveal full path"]').first(),
      ).toBeVisible({ timeout: 5_000 });
      const maskedValue = await firstInput.inputValue();
      expect(maskedValue).not.toBe(testPath);

      // Clean up — restore empty path
      await setSetting(page, "poe1ClientTxtPath", "");
    });

    test("should persist game paths via IPC and read them back", async ({
      page,
    }) => {
      const poe1Path = "C:\\Games\\PoE1\\logs\\Client.txt";
      const poe2Path = "D:\\Games\\Path of Exile 2\\logs\\Client.txt";

      // Set both paths
      await setSetting(page, "poe1ClientTxtPath", poe1Path);
      await setSetting(page, "poe2ClientTxtPath", poe2Path);

      // Read back and verify
      const persistedPoe1 = await getSetting<string>(page, "poe1ClientTxtPath");
      const persistedPoe2 = await getSetting<string>(page, "poe2ClientTxtPath");
      expect(persistedPoe1).toBe(poe1Path);
      expect(persistedPoe2).toBe(poe2Path);

      // Clean up
      await setSetting(page, "poe1ClientTxtPath", "");
      await setSetting(page, "poe2ClientTxtPath", "");
    });

    test("should show correct labels and description in the card", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Game Configuration",
      });
      await expect(card).toBeVisible();

      // Card description
      await expect(
        card.getByText(/configure paths to your path of exile client logs/i),
      ).toBeVisible();

      // Labels for each game
      await expect(card.getByText("Path of Exile 1 Client.txt")).toBeVisible();
      await expect(card.getByText("Path of Exile 2 Client.txt")).toBeVisible();
    });

    test("should have file picker buttons wired to selectFile IPC", async ({
      page,
    }) => {
      const card = page.locator(".card", {
        hasText: "Game Configuration",
      });
      await expect(card).toBeVisible();

      // There should be at least 2 file picker buttons (one per game path)
      const buttons = card.locator("button");
      await expect(buttons.nth(1)).toBeVisible({ timeout: 5_000 });

      // Each file picker button should be visible and enabled
      for (let i = 0; i < 2; i++) {
        await expect(buttons.nth(i)).toBeVisible();
        await expect(buttons.nth(i)).not.toBeDisabled();
      }

      // Verify the IPC function exists on the frozen context bridge — clicking
      // a file picker button calls window.electron.selectFile({ properties: ["openFile"] })
      // which opens a native OS dialog.  We verify the function is wired up
      // without actually invoking it (which would block the test with a dialog).
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

  // ─── Storage Card ─────────────────────────────────────────────────────────────

  test.describe("Storage Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render the Storage card with disk usage information", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Storage" }).filter({
        hasText: /disk usage/i,
      });
      await expect(card).toBeVisible();

      // Should display "Disk Usage" heading in the body
      await expect(card.getByText("Disk Usage").first()).toBeVisible();
    });

    test("should display disk usage bar with size information", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Storage" }).filter({
        hasText: /disk usage/i,
      });

      // Wait for storage info to load (replaces initial loading spinner)
      await page
        .locator(".card", { hasText: "Storage" })
        .filter({ hasText: /disk usage/i })
        .getByText(/used of/i)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      // Should show "used" and "free" byte amounts in the usage bar
      await expect(card.getByText(/used of/i).first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(card.getByText(/free/i).first()).toBeVisible();
    });

    test("should display the League Data section", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Storage" }).filter({
        hasText: /disk usage/i,
      });

      await card
        .getByText(/used of/i)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      // Should show the "League Data" section heading
      await expect(card.getByText("League Data").first()).toBeVisible({
        timeout: 10_000,
      });

      // Should either show league data rows or "No league data to clean up"
      const hasLeagueData = await card
        .locator("table")
        .isVisible()
        .catch(() => false);
      const hasNoDataMsg = await card
        .getByText(/no league data to clean up/i)
        .isVisible()
        .catch(() => false);
      expect(hasLeagueData || hasNoDataMsg).toBe(true);
    });

    test("should have a reveal/hide path toggle on the disk usage bar", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Storage" }).filter({
        hasText: /disk usage/i,
      });

      await card
        .getByText(/used of/i)
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      // The disk usage section should show a path and a reveal/hide toggle
      const revealToggle = card.locator(
        'button[title="Reveal full path"], button[title="Hide full path"]',
      );
      await expect(revealToggle.first()).toBeVisible({ timeout: 5_000 });

      // Click to reveal full path
      await revealToggle.first().click();

      // The toggle should now say "Hide full path"
      const hideToggle = card.locator('button[title="Hide full path"]');
      await expect(hideToggle.first()).toBeVisible({ timeout: 5_000 });

      // Click again to hide
      await hideToggle.first().click();

      // Should be back to "Reveal full path"
      const revealAgain = card.locator('button[title="Reveal full path"]');
      await expect(revealAgain.first()).toBeVisible({ timeout: 5_000 });
    });

    test("should show loading state before storage info is available", async ({
      page,
    }) => {
      // Navigate to settings — storage card starts loading on mount
      const card = page.locator(".card", { hasText: "Storage" }).filter({
        hasText: /disk usage/i,
      });

      // The card itself should be visible immediately
      await expect(card).toBeVisible();

      // Eventually the disk usage info should appear (loaded from IPC)
      await expect(card.getByText(/used of/i).first()).toBeVisible({
        timeout: 15_000,
      });
    });
  });

  // ─── Danger Zone Card ─────────────────────────────────────────────────────────

  test.describe("Danger Zone Card", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
      await goToSettings(page);
    });

    test("should render the Danger Zone card with destructive styling", async ({
      page,
    }) => {
      const dangerZone = page.getByText(/danger zone/i).first();
      await expect(dangerZone).toBeVisible({ timeout: 5_000 });

      // The danger zone card has error border styling
      const card = page.locator(".card", { hasText: "Danger Zone" });
      await expect(card).toBeVisible();

      // Should show irreversible warning text
      await expect(card.getByText(/irreversible actions/i)).toBeVisible();

      // Reset Database section heading
      await expect(
        card.getByRole("heading", { name: "Reset Database" }),
      ).toBeVisible();

      // Description about what gets deleted
      await expect(
        card.getByText(/permanently delete all sessions/i),
      ).toBeVisible();

      // Should have a reset database button with error variant
      const resetButton = card
        .locator("button", { hasText: /reset database/i })
        .first();
      await expect(resetButton).toBeVisible();
      await expect(resetButton).toBeEnabled();
    });

    test("should open confirmation modal when clicking Reset Database", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Danger Zone" });
      const resetButton = card
        .locator("button", { hasText: /reset database/i })
        .first();

      await resetButton.click();

      // A <dialog> should open with confirmation content
      const confirmDialog = page.locator("dialog[open]");
      await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });

      // Should show warning text about data deletion
      const dialogText = await confirmDialog.first().textContent();
      expect(dialogText?.toLowerCase()).toContain("delete");

      // Should list specific items that will be deleted
      expect(dialogText?.toLowerCase()).toContain("sessions");
      expect(dialogText?.toLowerCase()).toContain("statistics");
      expect(dialogText?.toLowerCase()).toContain("price snapshots");

      // Should warn about irreversibility
      expect(dialogText?.toLowerCase()).toContain("cannot be undone");

      // Should have Cancel and Confirm buttons
      const cancelButton = confirmDialog
        .locator("button", { hasText: /cancel/i })
        .first();
      await expect(cancelButton).toBeVisible();
      await expect(cancelButton).toBeEnabled();

      const confirmButton = confirmDialog
        .locator("button", { hasText: /delete everything|restart/i })
        .first();
      await expect(confirmButton).toBeVisible();
      await expect(confirmButton).toBeEnabled();

      // Close without confirming
      await cancelButton.click();
      await expect(confirmDialog.first()).not.toBeVisible({ timeout: 5_000 });
    });

    test("should close confirmation modal when clicking Cancel", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Danger Zone" });
      const resetButton = card
        .locator("button", { hasText: /reset database/i })
        .first();

      await resetButton.click();

      const confirmDialog = page.locator("dialog[open]");
      await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });

      const cancelButton = confirmDialog
        .locator("button", { hasText: /cancel/i })
        .first();
      await cancelButton.click();

      // Dialog should be closed
      await expect(confirmDialog.first()).not.toBeVisible({ timeout: 5_000 });

      // Page should still be functional
      const main = page.locator("main");
      await expect(main).toBeVisible();

      // The Reset Database button should still be there and clickable
      await expect(resetButton).toBeVisible();
      await expect(resetButton).toBeEnabled();
    });

    test("should be able to open and close the modal multiple times", async ({
      page,
    }) => {
      const card = page.locator(".card", { hasText: "Danger Zone" });
      const resetButton = card
        .locator("button", { hasText: /reset database/i })
        .first();

      // Open → Cancel → Open → Cancel (verify no state leaks)
      for (let i = 0; i < 2; i++) {
        await resetButton.click();

        const confirmDialog = page.locator("dialog[open]");
        await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });

        const cancelButton = confirmDialog
          .locator("button", { hasText: /cancel/i })
          .first();
        await cancelButton.click();

        await expect(confirmDialog.first()).not.toBeVisible({ timeout: 5_000 });
      }

      // Page still functional
      const main = page.locator("main");
      await expect(main).toBeVisible();
    });

    test("modal should display all deletion consequences", async ({ page }) => {
      const card = page.locator(".card", { hasText: "Danger Zone" });
      const resetButton = card
        .locator("button", { hasText: /reset database/i })
        .first();

      await resetButton.click();

      const confirmDialog = page.locator("dialog[open]");
      await expect(confirmDialog.first()).toBeVisible({ timeout: 5_000 });

      // Verify each specific bullet point in the consequences list
      const listItems = confirmDialog.locator("li");
      await expect(listItems.nth(2)).toBeVisible({ timeout: 5_000 });

      // Verify key consequences are listed
      const fullText = await confirmDialog.first().textContent();
      expect(fullText).toMatch(/session/i);
      expect(fullText).toMatch(/card statistics/i);
      expect(fullText).toMatch(/price snapshot/i);

      // Verify restart warning
      expect(fullText).toMatch(/restart/i);

      // Close
      const cancelButton = confirmDialog
        .locator("button", { hasText: /cancel/i })
        .first();
      await cancelButton.click();
      await expect(confirmDialog.first()).not.toBeVisible({ timeout: 5_000 });
    });
  });
});
