/**
 * E2E Test: Settings — Audio Card
 *
 * Tests the Audio settings card:
 * 1. Enable/disable drop sounds toggle and gating of child controls
 * 2. Volume slider adjustment and percentage display
 * 3. Scanning fixture sounds and populating rarity select dropdowns
 * 4. Selecting custom sounds per rarity tier, persisting via IPC, resetting to default
 * 5. Preview (play/stop) buttons for each rarity
 * 6. Find sounds button wired to IPC
 * 7. Full end-to-end flow combining all audio interactions
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Setup must be complete (or completable via skipSetup)
 *
 * @module e2e/flows/settings/settings-audio
 */

import {
  cleanupAudioFixtures,
  FIXTURE_SOUNDS,
  seedAudioFixtures,
} from "../../helpers/audio-fixtures";
import { expect, type Page, test } from "../../helpers/electron-test";
import { getSetting } from "../../helpers/ipc-helpers";
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

test.describe("Settings — Audio Card", () => {
  /**
   * Helper: locate the Audio card unambiguously.
   */
  const audioCard = (page: Page) =>
    page.locator(".card", { hasText: "Audio" }).filter({
      hasText: "Configure sounds for rare divination card drops",
    });

  /**
   * Helper: locate the "Enable drop sounds" toggle.
   */
  const enableToggle = (page: Page) =>
    audioCard(page)
      .locator("label", { hasText: "Enable drop sounds" })
      .locator('input[type="checkbox"]');

  /**
   * Helper: ensure audio is enabled before a test that needs it.
   * Returns the original checked state so callers can restore.
   */
  async function ensureAudioEnabled(page: Page): Promise<boolean> {
    const toggle = enableToggle(page);
    const wasChecked = await toggle.isChecked();
    if (!wasChecked) {
      await toggle.click({ force: true });
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    }
    return wasChecked;
  }

  test.beforeEach(async ({ app, page }) => {
    // Seed dummy mp3 fixture files so scan always finds sounds
    await seedAudioFixtures(app);
    await ensurePostSetup(page);
    await goToSettings(page);
  });

  test.afterAll(async ({ app }) => {
    await cleanupAudioFixtures(app);
  });

  // ── Enable / Disable Gating ──────────────────────────────────────────

  test("should toggle 'Enable drop sounds' and persist via IPC", async ({
    page,
  }) => {
    const toggle = enableToggle(page);
    const wasChecked = await toggle.isChecked();

    const targetChecked = !wasChecked;
    await toggle.click({ force: true });
    if (targetChecked) {
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    } else {
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });
    }

    const isNowChecked = await toggle.isChecked();
    expect(isNowChecked).not.toBe(wasChecked);

    const persisted = await getSetting<boolean>(page, "audioEnabled");
    expect(persisted).toBe(isNowChecked);

    // Restore
    await toggle.click({ force: true });
    if (wasChecked) {
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    } else {
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });
    }
  });

  test("should disable volume, selects, scan, find, and preview buttons when audio is off", async ({
    page,
  }) => {
    const card = audioCard(page);
    const toggle = enableToggle(page);

    // Ensure audio is OFF
    const wasChecked = await toggle.isChecked();
    if (wasChecked) {
      await toggle.click({ force: true });
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });
    }

    // Volume slider
    await expect(card.locator('input[type="range"]').first()).toBeDisabled();

    // All 3 rarity selects
    const selects = card.locator("select");
    for (let i = 0; i < 3; i++) {
      await expect(selects.nth(i)).toBeDisabled();
    }

    // Load/Refresh sounds button
    await expect(
      card
        .locator("button", { hasText: /load sounds|refresh sounds/i })
        .first(),
    ).toBeDisabled();

    // Find sounds button
    await expect(
      card.locator("button", { hasText: /find sounds/i }).first(),
    ).toBeDisabled();

    // Preview buttons
    const previewButtons = card.locator('button[title="Preview"]');
    for (let i = 0; i < (await previewButtons.count()); i++) {
      await expect(previewButtons.nth(i)).toBeDisabled();
    }

    // Restore
    if (wasChecked) {
      await toggle.click({ force: true });
      await expect(toggle).toBeChecked({ timeout: 5_000 });
    }
  });

  test("should re-enable all controls when toggling audio back on", async ({
    page,
  }) => {
    const card = audioCard(page);
    const toggle = enableToggle(page);

    // Start disabled
    const wasChecked = await toggle.isChecked();
    if (wasChecked) {
      await toggle.click({ force: true });
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });
    }

    // Now enable
    await toggle.click({ force: true });
    await expect(toggle).toBeChecked({ timeout: 5_000 });

    // Volume slider
    await expect(
      card.locator('input[type="range"]').first(),
    ).not.toBeDisabled();

    // Selects
    const selects = card.locator("select");
    for (let i = 0; i < 3; i++) {
      await expect(selects.nth(i)).not.toBeDisabled();
    }

    // Preview buttons
    const previewButtons = card.locator('button[title="Preview"]');
    for (let i = 0; i < (await previewButtons.count()); i++) {
      await expect(previewButtons.nth(i)).not.toBeDisabled();
    }

    // Scan & Find buttons
    await expect(
      card
        .locator("button", { hasText: /load sounds|refresh sounds/i })
        .first(),
    ).not.toBeDisabled();
    await expect(
      card.locator("button", { hasText: /find sounds/i }).first(),
    ).not.toBeDisabled();

    // Restore original state
    if (!wasChecked) {
      await toggle.click({ force: true });
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });
    }
  });

  // ── Volume Slider ────────────────────────────────────────────────────

  test("should adjust volume slider, update percentage display, and persist via IPC", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    const volumeSlider = card.locator('input[type="range"]').first();
    const originalValue = await volumeSlider.inputValue();

    await volumeSlider.fill("0.75");
    await expect(volumeSlider).toHaveValue("0.75", { timeout: 5_000 });
    await expect(card.getByText("75%")).toBeVisible();

    const persisted = await getSetting<number>(page, "audioVolume");
    expect(persisted).toBeCloseTo(0.75, 1);

    // Slide to other extremes and check the display updates
    await volumeSlider.fill("0");
    await expect(card.getByText("0%")).toBeVisible({ timeout: 5_000 });

    await volumeSlider.fill("1");
    await expect(card.getByText("100%")).toBeVisible({ timeout: 5_000 });

    // Restore
    await volumeSlider.fill(originalValue);
    await expect(volumeSlider).toHaveValue(originalValue, { timeout: 5_000 });
  });

  // ── Scan → Populate Dropdowns ────────────────────────────────────────

  test("should scan fixture sounds and populate all 3 rarity select dropdowns", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    // Click scan — the seeded fixture mp3s should be discovered
    const scanButton = card
      .locator("button", { hasText: /load sounds|refresh sounds/i })
      .first();
    await scanButton.click();
    await expect(scanButton).not.toBeDisabled({ timeout: 10_000 });

    // After scanning, the button label should switch to "Refresh sounds"
    await expect(
      card.locator("button", { hasText: /refresh sounds/i }).first(),
    ).toBeVisible();

    // The "N sounds found" badge should appear
    await expect(card.getByText(/\d+ sounds? found/i)).toBeVisible();

    // Each rarity select should now contain the fixture filenames as options
    const selects = card.locator("select");
    for (let i = 0; i < 3; i++) {
      const select = selects.nth(i);
      const optionCount = await select.locator("option").count();
      // "Default (bundled)" + at least 3 fixture sounds
      expect(optionCount).toBeGreaterThanOrEqual(1 + FIXTURE_SOUNDS.length);
    }

    // Verify each fixture filename appears as an option in the first select
    const firstSelect = selects.first();
    for (const filename of FIXTURE_SOUNDS) {
      const option = firstSelect.locator("option", { hasText: filename });
      await expect(option).toBeAttached();
    }
  });

  // ── Select Custom Sound → Persist → Reset to Default ─────────────────

  test("should select a custom sound from dropdown, persist via IPC, then reset to default", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    // Scan to populate dropdowns with fixture sounds
    const scanButton = card
      .locator("button", { hasText: /load sounds|refresh sounds/i })
      .first();
    await scanButton.click();
    await expect(scanButton).not.toBeDisabled({ timeout: 10_000 });

    // Pick the first rarity select (Extremely Rare)
    const selects = card.locator("select");
    const firstSelect = selects.first();

    // It should currently be on default
    expect(await firstSelect.inputValue()).toBe("");

    // Select the first fixture sound option (option index 1, after "Default")
    const firstCustomOption = firstSelect.locator("option").nth(1);
    const customValue = await firstCustomOption.getAttribute("value");
    expect(customValue).toBeTruthy();

    await firstSelect.selectOption(customValue!);
    await expect(firstSelect).toHaveValue(customValue!, { timeout: 5_000 });

    // IPC should have persisted it as audioRarity1Path
    const persisted = await getSetting<string | null>(page, "audioRarity1Path");
    expect(persisted).toBe(customValue);

    // A "Reset to default" (✕) button should now be visible for this rarity
    const resetButton = card
      .locator('button[title="Reset to default"]')
      .first();
    await expect(resetButton).toBeVisible({ timeout: 3_000 });

    // Click reset — should go back to "Default (bundled)"
    await resetButton.click();
    await expect(firstSelect).toHaveValue("", { timeout: 5_000 });

    // IPC should reflect null (bundled default)
    const afterReset = await getSetting<string | null>(
      page,
      "audioRarity1Path",
    );
    expect(afterReset).toBeNull();
  });

  test("should select different custom sounds for each rarity tier independently", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    // Scan to populate
    const scanButton = card
      .locator("button", { hasText: /load sounds|refresh sounds/i })
      .first();
    await scanButton.click();
    await expect(scanButton).not.toBeDisabled({ timeout: 10_000 });

    const selects = card.locator("select");
    const rarityKeys = [
      "audioRarity1Path",
      "audioRarity2Path",
      "audioRarity3Path",
    ];

    // Assign a different fixture sound to each rarity tier
    for (let i = 0; i < 3; i++) {
      const select = selects.nth(i);
      // Pick the (i+1)th option to get different sounds per rarity
      const option = select.locator("option").nth(i + 1);
      const optionValue = await option.getAttribute("value");
      if (optionValue) {
        await select.selectOption(optionValue);
        await expect(select).toHaveValue(optionValue, { timeout: 5_000 });

        // Verify IPC persistence
        const persisted = await getSetting<string | null>(page, rarityKeys[i]);
        expect(persisted).toBe(optionValue);
      }
    }

    // Restore all to default
    for (let i = 0; i < 3; i++) {
      await selects.nth(i).selectOption("");
      await expect(selects.nth(i)).toHaveValue("", { timeout: 5_000 });
    }
  });

  // ── Preview (Play/Stop) Buttons ──────────────────────────────────────

  test("should click preview to play and click again to stop for each rarity", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    const previewButtons = card.locator('button[title="Preview"]');
    await expect(previewButtons).toHaveCount(3, { timeout: 5_000 });

    for (let i = 0; i < 3; i++) {
      const btn = previewButtons.nth(i);
      await expect(btn).not.toBeDisabled();

      // Click play — triggers handlePreviewRarity (bundled default sound)
      await btn.click();
      await page.waitForTimeout(100);

      // Click again to stop — toggles back
      await btn.click();
      await page.waitForTimeout(100);

      // Button should still be functional
      await expect(btn).toBeVisible();
      await expect(btn).not.toBeDisabled();
    }
  });

  test("should preview a custom sound after selecting it from dropdown", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    // Scan to load fixture sounds
    const scanButton = card
      .locator("button", { hasText: /load sounds|refresh sounds/i })
      .first();
    await scanButton.click();
    await expect(scanButton).not.toBeDisabled({ timeout: 10_000 });

    // Select a custom sound for the first rarity
    const firstSelect = card.locator("select").first();
    const firstCustomOption = firstSelect.locator("option").nth(1);
    const customValue = await firstCustomOption.getAttribute("value");
    if (customValue) {
      await firstSelect.selectOption(customValue);
      await expect(firstSelect).toHaveValue(customValue, { timeout: 5_000 });

      // Click the first preview button — should play the custom sound
      const firstPreview = card.locator('button[title="Preview"]').first();
      await firstPreview.click();
      await page.waitForTimeout(100);

      // Click again to stop
      await firstPreview.click();
      await page.waitForTimeout(100);

      // Button should still be functional, no crash
      await expect(firstPreview).toBeVisible();
    }

    // Restore to default
    await firstSelect.selectOption("");
    await expect(firstSelect).toHaveValue("", { timeout: 5_000 });
  });

  // ── Find Sounds Button ───────────────────────────────────────────────

  test("should have 'Find sounds' button wired to openCustomSoundsFolder IPC", async ({
    page,
  }) => {
    const card = audioCard(page);
    await ensureAudioEnabled(page);

    const findButton = card
      .locator("button", { hasText: /find sounds/i })
      .first();
    await expect(findButton).toBeVisible();
    await expect(findButton).not.toBeDisabled();

    // The button's click handler calls window.electron.settings.openCustomSoundsFolder()
    // which opens the native OS file manager. We can't spy on the frozen context bridge,
    // so instead verify the IPC function exists and is callable.
    const ipcExists = await page.evaluate(() => {
      const w = window as any;
      return typeof w.electron?.settings?.openCustomSoundsFolder === "function";
    });
    expect(ipcExists).toBe(true);
  });

  // ── Full End-to-End Flow ─────────────────────────────────────────────

  test("full flow: enable → volume → scan → assign sounds → preview → reset all to default", async ({
    page,
  }) => {
    const card = audioCard(page);

    // 1. Enable audio
    const originalEnabled = await ensureAudioEnabled(page);

    // 2. Set volume
    const volumeSlider = card.locator('input[type="range"]').first();
    const originalVolume = await volumeSlider.inputValue();
    await volumeSlider.fill("0.6");
    await expect(card.getByText("60%")).toBeVisible({ timeout: 5_000 });

    // 3. Scan — fixture mp3s should appear
    const scanButton = card
      .locator("button", { hasText: /load sounds|refresh sounds/i })
      .first();
    await scanButton.click();
    await expect(scanButton).not.toBeDisabled({ timeout: 10_000 });
    await expect(card.getByText(/\d+ sounds? found/i)).toBeVisible();

    // 4. Assign a fixture sound to each rarity
    const selects = card.locator("select");
    for (let i = 0; i < 3; i++) {
      const select = selects.nth(i);
      const customOption = select.locator("option").nth(1);
      const val = await customOption.getAttribute("value");
      if (val) {
        await select.selectOption(val);
        await expect(select).toHaveValue(val, { timeout: 5_000 });
      }
    }

    // 5. Preview the first rarity's assigned sound
    const firstPreview = card.locator('button[title="Preview"]').first();
    await firstPreview.click();
    await page.waitForTimeout(100);
    await firstPreview.click(); // stop
    await page.waitForTimeout(100);

    // 6. Reset each rarity back to "Default (bundled)" via the ✕ button
    // Reset buttons appear for each rarity that has a custom assignment
    let resetButton = card.locator('button[title="Reset to default"]').first();
    while (await resetButton.isVisible().catch(() => false)) {
      await resetButton.click();
      await page.waitForTimeout(100);
      resetButton = card.locator('button[title="Reset to default"]').first();
    }

    // All selects should be back on default
    for (let i = 0; i < 3; i++) {
      expect(await selects.nth(i).inputValue()).toBe("");
    }

    // 7. Restore original state
    await volumeSlider.fill(originalVolume);
    await expect(volumeSlider).toHaveValue(originalVolume, { timeout: 5_000 });
    if (!originalEnabled) {
      await enableToggle(page).click({ force: true });
    }
  });
});
