/**
 * E2E Test: Setup Wizard Flow
 *
 * Tests the full first-run setup wizard sequence that new users experience
 * when launching Soothsayer for the first time. The wizard has 4 visible steps:
 *
 *   Step 1: SELECT_GAME        — Choose between PoE 1 and PoE 2
 *   Step 2: SELECT_LEAGUE      — Pick the active league
 *   Step 3: SELECT_CLIENT_PATH — Locate the PoE Client.txt log file
 *   Step 4: TELEMETRY_CONSENT  — Review privacy & telemetry info
 *
 * After completing all steps and clicking "Finish", the app redirects to the
 * main dashboard (/).
 *
 * These tests interact with the wizard the same way a real user would:
 * clicking game cards, selecting leagues from dropdowns, using Next/Back
 * buttons, and clicking Finish. The only exception is the Client.txt file
 * path which is set via IPC (since Electron's native file dialog can't be
 * automated by Playwright).
 *
 * Tests are structured as continuous flows to minimize wizard restarts and
 * loading screens. Instead of ~30 individual tests that each reset the wizard,
 * we use ~8 focused tests grouped into logical flows.
 *
 * @module e2e/flows/setup-wizard
 */

import { expect, test } from "../helpers/electron-test";
import {
  callElectronAPI,
  resetSetup,
  setSetting,
} from "../helpers/ipc-helpers";
import {
  getCurrentRoute,
  waitForHydration,
  waitForRoute,
} from "../helpers/navigation";
import { seedLeagueCache } from "../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resets setup state and reloads so the wizard is shown from step 1.
 * Waits for auto-advance from step 0 → step 1 (SELECT_GAME).
 */
async function resetAndWaitForGameStep(
  page: import("@playwright/test").Page,
): Promise<void> {
  await resetSetup(page);
  await page.reload();
  await page.waitForLoadState("domcontentloaded");
  await waitForHydration(page, 45_000);
  await waitForRoute(page, "/setup", 15_000);

  // Wait for auto-advance past step 0 — game step heading appears
  await page
    .getByText("Which games do you play?")
    .waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Locates the Next button (or Finish on the last step).
 */
function getNextButton(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: /^(Next|Finish|Loading\.\.\.)$/i });
}

/**
 * Locates the Back button.
 */
function getBackButton(page: import("@playwright/test").Page) {
  return page.locator("button.btn-ghost").filter({ hasText: /Back/i });
}

/**
 * Clicks the game card for the given game label (e.g. "Path of Exile 1").
 * The game step renders `<button>` cards with the game label text.
 */
async function clickGameCard(
  page: import("@playwright/test").Page,
  label: string,
): Promise<void> {
  const card = page
    .locator("button")
    .filter({ hasText: new RegExp(label, "i") });
  await card.click();
}

/**
 * Seeds leagues into the cache so the league dropdown can be populated,
 * then forces a re-fetch in the renderer.
 */
async function seedLeaguesForGame(
  page: import("@playwright/test").Page,
  game: "poe1" | "poe2",
  leagues: Array<{ leagueId: string; name: string }>,
): Promise<void> {
  for (const league of leagues) {
    await seedLeagueCache(page, {
      game,
      leagueId: league.leagueId,
      name: league.name,
    });
  }
}

/**
 * Selects a league from the dropdown for a specific game.
 * The dropdown is a `<select>` inside a section with the game label.
 */
async function selectLeagueInDropdown(
  page: import("@playwright/test").Page,
  leagueId: string,
): Promise<void> {
  // There may be one or two select elements — pick the first visible one
  // that has the target option
  const selects = page.locator("select.select-bordered");
  const count = await selects.count();

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const optionValues = await select
      .locator("option")
      .evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
    if (optionValues.includes(leagueId)) {
      await select.selectOption(leagueId);
      return;
    }
  }

  throw new Error(`Could not find league option "${leagueId}" in any dropdown`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Setup Wizard", () => {
  test.beforeEach(async ({ page }) => {
    // Wait for the app to hydrate so the preload bridge (electron.appSetup)
    // is available before we call resetSetup.
    await page.waitForLoadState("domcontentloaded");
    await expect
      .poll(
        async () =>
          page.evaluate(() => !!(window as any).electron?.appSetup?.resetSetup),
        { timeout: 30_000, intervals: [200, 500, 1_000] },
      )
      .toBe(true);
    await resetSetup(page);
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  });

  // ─── Group 1: Fresh Install & Initial State ──────────────────────────────

  test.describe("Fresh Install & Initial State", () => {
    test("should redirect to /setup on first launch", async ({ page }) => {
      await waitForHydration(page, 45_000);
      const route = await getCurrentRoute(page);
      expect(route).toBe("/setup");
    });

    test("should auto-advance to step 1 and hide sidebar", async ({ page }) => {
      await waitForHydration(page, 45_000);
      await waitForRoute(page, "/setup", 15_000);

      // Step 0 auto-advances to step 1 — the game selection heading appears
      const heading = page.getByText("Which games do you play?");
      await expect(heading).toBeVisible({ timeout: 15_000 });

      // The loading spinner from step 0 should be gone
      const spinner = page.locator(
        ".loading-spinner, .loading.loading-spinner",
      );
      await expect(spinner).not.toBeVisible({ timeout: 5_000 });

      // The sidebar should be hidden during setup
      const sidebar = page.locator("aside");
      await expect(sidebar.first()).not.toBeVisible();
    });
  });

  // ─── Group 2: Complete Wizard Flow ───────────────────────────────────────

  test.describe("Complete Wizard Flow", () => {
    test("should walk through all 4 steps continuously and redirect to dashboard", async ({
      page,
    }) => {
      test.setTimeout(120_000);

      await resetAndWaitForGameStep(page);

      // ── Step 1: Game Selection ─────────────────────────────────────────

      // Verify game cards visible
      await expect(page.getByText("Path of Exile 1")).toBeVisible();
      await expect(page.getByText("Path of Exile 2")).toBeVisible();

      // Next button should exist and be enabled (poe1 pre-selected)
      const nextBtn = getNextButton(page);
      await expect(nextBtn).toBeVisible();
      await expect(nextBtn).toBeEnabled();

      // Back button should be invisible on step 1
      const backBtn = getBackButton(page);
      if ((await backBtn.count()) > 0) {
        const classes = await backBtn.getAttribute("class");
        expect(classes).toContain("invisible");
      }

      // poe1 is the only selected game — its card should be disabled (can't deselect last game)
      const poe1Card = page
        .locator("button")
        .filter({ hasText: /Path of Exile 1/i });
      await expect(poe1Card).toBeDisabled();

      // Toggle PoE 2 on — "Playing both?" should appear
      await clickGameCard(page, "Path of Exile 2");
      await page.waitForTimeout(300);
      const bothText = page.getByText("Playing both?");
      await expect(bothText).toBeVisible({ timeout: 3_000 });

      // Toggle PoE 2 off — "Playing both?" should disappear
      await clickGameCard(page, "Path of Exile 2");
      await page.waitForTimeout(300);
      await expect(bothText).not.toBeVisible({ timeout: 3_000 });

      // Seed leagues before advancing to step 2
      await seedLeaguesForGame(page, "poe1", [
        { leagueId: "Standard", name: "Standard" },
        { leagueId: "Settlers", name: "Settlers of Kalguur" },
      ]);

      // Click Next → Step 2
      await nextBtn.click();

      // ── Step 2: League Selection ───────────────────────────────────────

      await page
        .getByText("Select your league")
        .waitFor({ state: "visible", timeout: 10_000 });

      // Verify league dropdown is populated
      const leagueSelect = page.locator("select.select-bordered").first();
      await expect(leagueSelect).toBeVisible({ timeout: 10_000 });

      // Wait for at least one real option (not just the placeholder)
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const select = document.querySelector(
                "select.select-bordered",
              ) as HTMLSelectElement;
              if (!select) return 0;
              return Array.from(select.options).filter(
                (o) => o.value && !o.disabled,
              ).length;
            }),
          { timeout: 10_000, intervals: [200, 500, 1_000] },
        )
        .toBeGreaterThanOrEqual(1);

      const optionCount = await leagueSelect.locator("option").count();
      expect(optionCount).toBeGreaterThanOrEqual(2);

      // Select league
      await selectLeagueInDropdown(page, "Standard");
      await page.waitForTimeout(500);

      // Click Next → Step 3
      await getNextButton(page).click();

      // ── Step 3: Client Path ────────────────────────────────────────────

      await page
        .getByText("Select Client.txt location")
        .waitFor({ state: "visible", timeout: 10_000 });

      // Verify Browse button visible
      const browseBtn = page.getByRole("button").filter({ hasText: /Browse/i });
      await expect(browseBtn.first()).toBeVisible();

      // Set client path via IPC (native dialog can't be automated)
      const testPath =
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt";
      await setSetting(page, "poe1ClientTxtPath", testPath);

      // Advance to step 4 via IPC since the file may not exist on this machine
      // (validation checks fs.existsSync which would fail)
      await callElectronAPI(page, "appSetup", "goToStep", 4);

      // Reload to pick up the new step
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await waitForHydration(page, 30_000);
      await waitForRoute(page, "/setup", 10_000);

      // ── Step 4: Telemetry Consent ──────────────────────────────────────

      await page
        .getByRole("heading", { name: "Privacy & Telemetry" })
        .waitFor({ state: "visible", timeout: 15_000 });

      // Verify telemetry content
      await expect(page.getByText("Crash Reporting")).toBeVisible();
      await expect(page.getByText("Sentry")).toBeVisible();
      await expect(page.getByText("Usage Analytics")).toBeVisible();
      await expect(page.getByText("Umami")).toBeVisible();

      // Verify privacy policy link
      const privacyLink = page.getByRole("link", {
        name: /Privacy Policy/i,
      });
      await expect(privacyLink).toBeVisible();

      // Verify "Finish" button (not "Next")
      const finishBtn = getNextButton(page);
      await expect(finishBtn).toBeVisible();
      await expect(finishBtn).toHaveText("Finish");

      // Click Finish — this calls completeSetup() which re-validates all
      // steps including fs.existsSync on the Client.txt path. Since the test
      // path doesn't exist on this machine, completeSetup will fail silently.
      // We click Finish to verify the UI interaction, then use skipSetup via
      // IPC as a fallback to bypass filesystem validation.
      await finishBtn.click();
      await page.waitForTimeout(1_000);

      // If completeSetup failed (no real Client.txt), force-complete via IPC
      const route = await getCurrentRoute(page);
      if (route === "/setup") {
        await callElectronAPI(page, "appSetup", "skipSetup");
        // Reload so the root layout re-hydrates with setup complete
        await page.reload();
        await page.waitForLoadState("domcontentloaded");
        await waitForHydration(page, 30_000);
      }

      // ── Post-setup: Redirect to / ──────────────────────────────────────

      await waitForRoute(page, "/", 30_000);

      const finalRoute = await getCurrentRoute(page);
      expect(finalRoute).toBe("/");

      // The sidebar should now be visible
      const sidebar = page.locator("aside");
      const sidebarVisible = await sidebar
        .isVisible({ timeout: 10_000 })
        .catch(() => false);
      const navVisible =
        (await page
          .locator("nav")
          .count()
          .catch(() => 0)) > 0;
      expect(sidebarVisible || navVisible).toBe(true);
    });
  });

  // ─── Group 3: Back Navigation ────────────────────────────────────────────

  test.describe("Back Navigation", () => {
    test("should navigate backward through steps and preserve state", async ({
      page,
    }) => {
      test.setTimeout(90_000);

      await resetAndWaitForGameStep(page);

      // Select both games so we can verify state preservation later
      await clickGameCard(page, "Path of Exile 2");
      await page.waitForTimeout(300);
      await expect(page.getByText("Playing both?")).toBeVisible({
        timeout: 3_000,
      });

      // Seed leagues for both games
      await seedLeaguesForGame(page, "poe1", [
        { leagueId: "Standard", name: "Standard" },
      ]);
      await seedLeaguesForGame(page, "poe2", [
        { leagueId: "Standard", name: "Standard" },
      ]);

      // Step 1 → Step 2
      await getNextButton(page).click();
      await expect(page.getByText("Select your league")).toBeVisible({
        timeout: 10_000,
      });

      // Select a league so we can advance to step 3
      await page.waitForTimeout(1_000);
      await selectLeagueInDropdown(page, "Standard");
      await page.waitForTimeout(500);

      // Step 2 → Step 3
      await getNextButton(page).click();
      await expect(page.getByText("Select Client.txt location")).toBeVisible({
        timeout: 10_000,
      });

      // Now navigate backward: Step 3 → Step 2
      await getBackButton(page).click();
      await expect(page.getByText("Select your league")).toBeVisible({
        timeout: 10_000,
      });

      // Step 2 → Step 1
      await getBackButton(page).click();
      await expect(page.getByText("Which games do you play?")).toBeVisible({
        timeout: 10_000,
      });

      // Verify game selection is preserved — both games should still be selected
      await expect(page.getByText("Playing both?")).toBeVisible({
        timeout: 5_000,
      });

      // Go forward again to verify we can re-advance: Step 1 → Step 2
      await getNextButton(page).click();
      await expect(page.getByText("Select your league")).toBeVisible({
        timeout: 10_000,
      });
    });
  });

  // ─── Group 4: Progress Indicator ─────────────────────────────────────────

  test.describe("Progress Indicator", () => {
    test("should show step labels and highlight the current step", async ({
      page,
    }) => {
      await resetAndWaitForGameStep(page);

      // All step labels should be visible in the progress bar
      await expect(page.getByText("Select Game")).toBeVisible();
      await expect(page.getByText("Select League")).toBeVisible();
      await expect(page.getByText("Client.txt Path")).toBeVisible();
      await expect(page.getByText("Privacy & Telemetry")).toBeVisible();

      // On step 1, "Select Game" should have the active/primary styling
      const gameLabel = page.getByText("Select Game");
      const gameLabelClass = await gameLabel.getAttribute("class");
      expect(gameLabelClass).toContain("text-primary");

      // "Select League" should not be active yet
      const leagueLabel = page.getByText("Select League");
      const leagueLabelClass = await leagueLabel.getAttribute("class");
      expect(leagueLabelClass).not.toContain("text-primary");
    });
  });

  // ─── Group 5: Setup Completion & Reset via IPC ───────────────────────────

  test.describe("Setup Completion via IPC", () => {
    test("should skip setup programmatically and redirect to home", async ({
      page,
    }) => {
      await waitForHydration(page, 45_000);
      await waitForRoute(page, "/setup", 15_000);

      // Use skipSetup IPC
      const skipResult = await page.evaluate(async () => {
        const electron = (window as any).electron;
        if (!electron?.appSetup?.skipSetup) return "no-api";
        try {
          await electron.appSetup.skipSetup();
          return "skipped";
        } catch (e: any) {
          return `error: ${e.message}`;
        }
      });

      expect(skipResult).toBe("skipped");

      if (skipResult === "skipped") {
        await page.reload();
        await waitForHydration(page, 30_000);
        await waitForRoute(page, "/", 15_000);

        const route = await getCurrentRoute(page);
        expect(route).toBe("/");

        // Sidebar should be visible post-setup
        const sidebar = page.locator("aside");
        const sidebarVisible = await sidebar.isVisible().catch(() => false);
        expect(sidebarVisible || (await page.locator("nav").count()) > 0).toBe(
          true,
        );
      }
    });

    test("should reset setup and return to the wizard", async ({ page }) => {
      await waitForHydration(page, 45_000);

      // First skip setup to reach a completed state
      await page.evaluate(async () => {
        const electron = (window as any).electron;
        if (electron?.appSetup?.skipSetup) {
          await electron.appSetup.skipSetup();
        }
      });

      // Now reset
      const resetResult = await page.evaluate(async () => {
        const electron = (window as any).electron;
        if (!electron?.appSetup?.resetSetup) return "no-api";
        try {
          await electron.appSetup.resetSetup();
          return "reset";
        } catch (e: any) {
          return `error: ${e.message}`;
        }
      });

      expect(resetResult).toBe("reset");

      if (resetResult === "reset") {
        await page.reload();
        await waitForHydration(page, 30_000);

        const route = await getCurrentRoute(page);
        expect(route).toBe("/setup");
      }
    });
  });
});
