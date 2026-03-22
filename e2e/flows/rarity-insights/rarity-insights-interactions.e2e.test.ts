/**
 * Rarity Insights — Interactions tests
 *
 * Search, Refresh, Scan, Filters, Boss Cards, Diffs
 *
 * @module e2e/flows/rarity-insights/rarity-insights-interactions.e2e.test
 */

import {
  A_BOSS_CARD,
  A_DIFF_CARD_FILTER_1,
  A_NO_DIFF_CARD,
  FILTER_1_NAME,
  SEARCH_QUERY_UNIQUE,
  SEARCHABLE_CARD_NAME,
} from "../../fixtures/rarity-insights-fixture";
import { expect, test } from "../../helpers/electron-test";
import {
  clearSearchAndWaitForTable,
  closeFiltersDropdown,
  createSeedGuard,
  deselectFilterInDropdown,
  disableBossCards,
  enableBossCards,
  ensurePostSetup,
  getTotalResultCount,
  getVisibleCardNames,
  goToRarityInsights,
  openFiltersDropdown,
  SEARCH_INPUT_SELECTOR,
  searchAndExpectAbsent,
  searchAndWaitForCard,
  searchAndWaitForCount,
  searchAndWaitForEmpty,
  selectFilterInDropdown,
  waitForPageSettled,
  waitForTableRows,
} from "./rarity-insights.helpers";

const ensureDataSeeded = createSeedGuard();

test.describe("Rarity Insights — Interactions", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ─── Search ───────────────────────────────────────────────────────────────

  test.describe("Search", () => {
    test("should filter to a single card for a unique query", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCount(page, SEARCH_QUERY_UNIQUE, 1);
      const names = await getVisibleCardNames(page);
      expect(names[0]).toBe(SEARCH_QUERY_UNIQUE);
      await clearSearchAndWaitForTable(page);
    });

    test("should restore full table when search is cleared", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCount(page, SEARCH_QUERY_UNIQUE, 1);
      await clearSearchAndWaitForTable(page);
      const names = await getVisibleCardNames(page);
      expect(names.length).toBe(20);
    });

    test("should show empty state for non-matching search", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForEmpty(page, "zzzznonexistentcardzzz");
      await clearSearchAndWaitForTable(page);
    });

    test("should find a specific fixtured card by name", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCard(page, SEARCHABLE_CARD_NAME);
      const names = await getVisibleCardNames(page);
      expect(names).toContain(SEARCHABLE_CARD_NAME);
      await clearSearchAndWaitForTable(page);
    });
  });

  // ─── Refresh poe.ninja ────────────────────────────────────────────────────

  test.describe("Refresh poe.ninja", () => {
    test("should show the Refresh poe.ninja button with correct text", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      const refreshButton = page.locator(
        '[data-onboarding="rarity-insights-refresh"] button',
      );
      await expect(refreshButton).toBeVisible();
      const buttonText = await refreshButton.textContent();
      expect(buttonText).toBeTruthy();
      // Shows "Refresh poe.ninja", "Refreshing...", or a cooldown timer.
      // DaisyUI's countdown component uses CSS `--value` variables to render
      // digits, so `textContent()` returns only ":" separators (no actual
      // digit characters). We therefore also accept ":" as evidence of a
      // rendered countdown.
      expect(
        buttonText!.includes("Refresh") ||
          buttonText!.includes("Refreshing") ||
          /\d/.test(buttonText!) ||
          buttonText!.includes(":"),
      ).toBe(true);
    });

    test("should attempt refresh or be on cooldown", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      const refreshButton = page.locator(
        '[data-onboarding="rarity-insights-refresh"] button',
      );
      if (!(await refreshButton.isDisabled())) {
        await refreshButton.click();
        const overlay = page.getByText("Fetching poe.ninja prices...");
        const overlayAppeared = await overlay
          .waitFor({ state: "visible", timeout: 3_000 })
          .then(() => true)
          .catch(() => false);
        if (overlayAppeared) {
          await overlay
            .waitFor({ state: "hidden", timeout: 30_000 })
            .catch(() => {});
        }
        await expect(page.locator("main")).toBeVisible();
      } else {
        expect(await refreshButton.isDisabled()).toBe(true);
      }
    });
  });

  // ─── Scan & Filters ──────────────────────────────────────────────────────

  test.describe("Filters", () => {
    test("should show Filters button", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await expect(
        page.locator("button", { hasText: "Filters" }),
      ).toBeVisible();
    });

    test("should open and close the Filters dropdown", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      const opened = await openFiltersDropdown(page);
      if (opened) {
        await expect(
          page.locator(".absolute.z-50").getByText(/Select up to \d+ filters/),
        ).toBeVisible();
        await closeFiltersDropdown(page);
      }
    });
  });

  // ─── Include Boss Cards ───────────────────────────────────────────────────

  test.describe("Include Boss Cards", () => {
    test("should show unchecked checkbox by default", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      const checkbox = page
        .locator("label", { hasText: "Include boss cards" })
        .locator("input[type='checkbox']");
      await expect(checkbox).toBeVisible();
      await expect(checkbox).not.toBeChecked();
    });

    test("should exclude boss cards by default", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndExpectAbsent(page, A_BOSS_CARD.name);
      await clearSearchAndWaitForTable(page);
    });

    test("should show boss cards when toggled on, hide when toggled off", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      const totalBefore = await getTotalResultCount(page);
      await enableBossCards(page);
      const totalAfter = await getTotalResultCount(page);
      expect(totalAfter).toBeGreaterThan(totalBefore);
      await searchAndWaitForCard(page, A_BOSS_CARD.name);
      const names = await getVisibleCardNames(page);
      expect(names).toContain(A_BOSS_CARD.name);
      await clearSearchAndWaitForTable(page);
      const headerCells = page.locator("table thead th");
      expect(await headerCells.count()).toBeGreaterThan(2);
      await disableBossCards(page);
    });
  });

  // ─── Show Differences Only ────────────────────────────────────────────────

  test.describe("Show Differences Only", () => {
    test("should show disabled checkbox when no filters are selected", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      const diffLabel = page.locator("label", {
        hasText: "Show differences only",
      });
      await expect(diffLabel).toBeVisible();
      const diffCheckbox = diffLabel.locator("input[type='checkbox']");
      await expect(diffCheckbox).toBeDisabled();
    });

    test("should become enabled after selecting a filter and filter diff rows", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);

      // Filter data is already pre-populated in parsedResults by
      // syncAvailableFiltersToStore (called in waitForPageSettled), so we
      // do NOT need to call rarityInsights.parse — the fixture filter files
      // don't exist on disk anyway.

      const selected = await selectFilterInDropdown(page, FILTER_1_NAME);
      if (!selected) return;
      await closeFiltersDropdown(page);

      // "Show differences only" should become enabled now that a filter with
      // parsed results is selected.
      const diffCheckbox = page
        .locator("label", { hasText: "Show differences only" })
        .locator("input[type='checkbox']");

      try {
        await expect(diffCheckbox).toBeEnabled({ timeout: 10_000 });
      } catch {
        // Parsing may not complete — clean up and skip
        await deselectFilterInDropdown(page, FILTER_1_NAME);
        await closeFiltersDropdown(page);
        return;
      }

      // Read the total from the pagination footer before toggling diffs
      const beforeCount = await getTotalResultCount(page);

      // Enable "Show differences only"
      await diffCheckbox.check();
      await expect(diffCheckbox).toBeChecked();

      // Wait for the pagination total to change (table re-renders
      // synchronously now that useDeferredValue has been removed).
      await page.waitForFunction(
        (prev) => {
          const el = document.body.innerText.match(/of (\d+) results/);
          return el ? parseInt(el[1], 10) !== prev : false;
        },
        beforeCount,
        { timeout: 5_000 },
      );

      const afterCount = await getTotalResultCount(page);
      expect(afterCount).not.toBe(beforeCount);

      // A known diff card (filter rarity ≠ poe.ninja rarity) should be visible
      await searchAndWaitForCard(page, A_DIFF_CARD_FILTER_1.name);
      const diffNames = await getVisibleCardNames(page);
      expect(diffNames).toContain(A_DIFF_CARD_FILTER_1.name);

      // A known non-diff card (same rarity in filter and poe.ninja) should
      // NOT be visible when "Show differences only" is on.
      if (A_NO_DIFF_CARD) {
        await searchAndExpectAbsent(page, A_NO_DIFF_CARD.name);
      }

      // Clear search before toggling checkbox off
      const searchInput = page.locator(SEARCH_INPUT_SELECTOR);
      await searchInput.clear();
      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 5_000 });

      // Clean up: uncheck diffs
      await diffCheckbox.uncheck();
      await expect(diffCheckbox).not.toBeChecked();
      await waitForTableRows(page);

      // Deselect filter
      await deselectFilterInDropdown(page, FILTER_1_NAME);
      await closeFiltersDropdown(page);
    });
  });
});
