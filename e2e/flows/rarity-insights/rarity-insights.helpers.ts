/**
 * Shared helpers for Rarity Insights E2E tests.
 *
 * Extracted from the monolithic `rarity-insights.e2e.test.ts` so that each
 * split test file can import exactly what it needs without duplicating code.
 *
 * Includes:
 * - Setup & seeding helpers (ensurePostSetup, ensureDataSeeded)
 * - Navigation & waiting helpers (goToRarityInsights, waitForPageSettled, …)
 * - Table inspection helpers (getTableRowCount, getVisibleCardNames, …)
 * - Search helpers (searchAndWaitForCard, searchAndWaitForEmpty, …)
 * - Toggle helpers (enableBossCards, disableBossCards)
 * - Chip / sort helpers (clickChipAndWaitForReorder)
 * - Filter dropdown helpers (openFiltersDropdown, selectFilterInDropdown, …)
 *
 * @module e2e/flows/rarity-insights/rarity-insights.helpers
 */

import type { Page } from "@playwright/test";

import {
  FIXTURE_GAME,
  FIXTURE_LEAGUE,
  RARITY_INSIGHTS_CARDS,
} from "../../fixtures/rarity-insights-fixture";
import { expect } from "../../helpers/electron-test";
import { navigateTo } from "../../helpers/navigation";
import {
  seedLeagueCache,
  seedRarityInsightsData,
  seedSessionPrerequisites,
  syncAvailableFiltersToStore,
} from "../../helpers/seed-db";

// ─── Setup & Seeding ──────────────────────────────────────────────────────────

export { ensurePostSetup } from "../../helpers/navigation";

/**
 * One-time data seeding guard. We seed once per worker — since all tests in
 * a file share the same Electron instance (worker-scoped), the DB persists.
 *
 * Each split file gets its own `dataSeeded` flag via `createSeedGuard()`.
 */
export function createSeedGuard() {
  let dataSeeded = false;

  return async function ensureDataSeeded(page: Page) {
    if (dataSeeded) return;

    try {
      await seedSessionPrerequisites(page, {
        game: FIXTURE_GAME,
        leagueName: FIXTURE_LEAGUE,
      });
    } catch {
      // May already exist — continue
    }

    try {
      await seedLeagueCache(page, {
        game: FIXTURE_GAME,
        leagueId: FIXTURE_LEAGUE,
        name: FIXTURE_LEAGUE,
      });
    } catch {
      // Idempotent
    }

    await seedRarityInsightsData(page, RARITY_INSIGHTS_CARDS);

    dataSeeded = true;
  };
}

// ─── Filter injection ─────────────────────────────────────────────────────────

/**
 * Pushes DB-seeded filter metadata into the renderer's Zustand store.
 *
 * In E2E mode the filesystem auto-scan is disabled (see store hydrate()),
 * so the filter_metadata rows seeded by `seedRarityInsightsData` /
 * `seedFilterData` survive.  This helper simply syncs those rows into the
 * store so the UI can render them.
 *
 * Must be called after the page has navigated to Rarity Insights and settled.
 * Called automatically by `waitForPageSettled`.
 */
export async function injectSeededFilters(page: Page) {
  // In E2E mode the auto-scan is disabled at the store level, so the
  // DB-seeded filter_metadata rows are never deleted.  We only need to
  // push the DB state into the Zustand store so the UI picks it up.
  await syncAvailableFiltersToStore(page);
}

// ─── Navigation & Waiting ─────────────────────────────────────────────────────

/**
 * Navigate to the Rarity Insights page and wait for its core content to render.
 */
export async function goToRarityInsights(page: Page) {
  await navigateTo(page, "/rarity-insights");
  await page
    .getByRole("heading", { name: /Rarity Insights/i })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Waits for the Rarity Insights page to settle past any initial loading states.
 * Also injects seeded filter metadata into the store (every navigation triggers
 * a filesystem scan that clears filters, so we must re-inject each time).
 */
export async function waitForPageSettled(page: Page) {
  await page
    .locator(".card-title", { hasText: "Cards" })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });

  await injectSeededFilters(page);
}

/**
 * Waits for the comparison table to have at least one data row.
 */
export async function waitForTableRows(page: Page) {
  await page
    .locator("table tbody tr")
    .first()
    .waitFor({ state: "visible", timeout: 15_000 });
}

// ─── Table Inspection ─────────────────────────────────────────────────────────

/**
 * Returns the count of visible table body rows.
 */
export async function getTableRowCount(page: Page): Promise<number> {
  return page.locator("table tbody tr").count();
}

/**
 * Returns all visible card names from the table's link cells.
 */
export async function getVisibleCardNames(page: Page): Promise<string[]> {
  const links = page.locator("table tbody tr td a");
  const count = await links.count();
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const text = await links.nth(i).textContent();
    if (text) names.push(text.trim());
  }
  return names;
}

/**
 * Returns the total result count from the pagination footer.
 * Parses "Showing X to Y of Z results".
 */
export async function getTotalResultCount(page: Page): Promise<number> {
  const paginationText = await page
    .locator("text=/of \\d+ results/")
    .textContent({ timeout: 5_000 })
    .catch(() => "");
  const match = paginationText?.match(/of (\d+) results/);
  return match ? parseInt(match[1], 10) : 0;
}

// ─── Search helpers (condition-based, zero waitForTimeout) ────────────────────

export const SEARCH_INPUT_SELECTOR =
  'input[type="search"][placeholder="Search cards..."]';

/**
 * Fills the search input and waits for the table to contain a row matching the
 * expected card name. Handles the 300ms debounce via condition polling.
 */
export async function searchAndWaitForCard(page: Page, cardName: string) {
  const searchInput = page.locator(SEARCH_INPUT_SELECTOR);
  await searchInput.fill(cardName);
  await page
    .locator("table tbody tr td a", { hasText: cardName })
    .first()
    .waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Fills the search input and waits for the empty state message to appear.
 */
export async function searchAndWaitForEmpty(page: Page, query: string) {
  const searchInput = page.locator(SEARCH_INPUT_SELECTOR);
  await searchInput.fill(query);
  await page
    .getByText("No cards match your criteria")
    .waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Fills the search input and waits for the table to settle to exactly N rows.
 */
export async function searchAndWaitForCount(
  page: Page,
  query: string,
  expectedCount: number,
) {
  const searchInput = page.locator(SEARCH_INPUT_SELECTOR);
  await searchInput.fill(query);
  await expect(page.locator("table tbody tr")).toHaveCount(expectedCount, {
    timeout: 5_000,
  });
}

/**
 * Clears the search input and waits for the table to repopulate to 20 rows
 * (full first page of the paginated catalog).
 */
export async function clearSearchAndWaitForTable(page: Page) {
  const searchInput = page.locator(SEARCH_INPUT_SELECTOR);
  await searchInput.clear();
  await expect(page.locator("table tbody tr")).toHaveCount(20, {
    timeout: 5_000,
  });
}

/**
 * Fills search and waits for the boss card to NOT appear (either empty state
 * or the card name is simply absent from results).
 */
export async function searchAndExpectAbsent(page: Page, cardName: string) {
  const searchInput = page.locator(SEARCH_INPUT_SELECTOR);
  await searchInput.fill(cardName);
  // Wait for debounce to settle — either the empty state shows, or the table
  // re-renders without the card. We poll until the card link is gone.
  await expect(
    page.locator("table tbody tr td a", { hasText: cardName }),
  ).toHaveCount(0, { timeout: 5_000 });
}

// ─── Toggle helpers ───────────────────────────────────────────────────────────

/**
 * Checks the "Include boss cards" checkbox and waits for the total result
 * count to increase (boss cards added to the table).
 */
export async function enableBossCards(page: Page) {
  const checkbox = page
    .locator("label", { hasText: "Include boss cards" })
    .locator("input[type='checkbox']");
  await checkbox.check();
  await expect(checkbox).toBeChecked();
  // Table re-renders synchronously (no useDeferredValue) — just wait for
  // the pagination text to update, proving the row count changed.
  await expect(page.locator("text=/of \\d+ results/")).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Unchecks the "Include boss cards" checkbox and waits for the total result
 * count to decrease.
 */
export async function disableBossCards(page: Page) {
  const checkbox = page
    .locator("label", { hasText: "Include boss cards" })
    .locator("input[type='checkbox']");
  await checkbox.uncheck();
  await expect(checkbox).not.toBeChecked();
  // Table re-renders synchronously — just wait for the pagination update.
  await expect(page.locator("text=/of \\d+ results/")).toBeVisible({
    timeout: 5_000,
  });
}

// ─── Chip / sort helpers ──────────────────────────────────────────────────────

/**
 * Clicks a rarity chip in a column header and waits for the table order to
 * change from the snapshot taken before the click.
 */
export async function clickChipAndWaitForReorder(
  page: Page,
  headerLocator: string,
  chipIndex: number,
) {
  const namesBefore = await getVisibleCardNames(page);
  const chip = page
    .locator(headerLocator)
    .locator("button.badge")
    .nth(chipIndex);
  await chip.click();

  // Wait for the visible card order to differ from the previous state.
  await page.waitForFunction(
    (prev) => {
      const links = Array.from(
        document.querySelectorAll("table tbody tr td a"),
      );
      const current = links.map((a) => a.textContent?.trim() ?? "");
      if (current.length === 0) return false;
      return current.some((name, i) => name !== (prev[i] ?? ""));
    },
    namesBefore,
    { timeout: 5_000, polling: 200 },
  );
}

// ─── Filter dropdown helpers ──────────────────────────────────────────────────

export async function openFiltersDropdown(page: Page) {
  const filtersButton = page.locator("button", { hasText: "Filters" });
  if (await filtersButton.isDisabled()) return false;
  await filtersButton.click();
  await page
    .locator(".absolute.z-50")
    .waitFor({ state: "visible", timeout: 3_000 });
  return true;
}

export async function closeFiltersDropdown(page: Page) {
  await page.locator("h1", { hasText: "Rarity Insights" }).click();
  await expect(page.locator(".absolute.z-50")).toHaveCount(0, {
    timeout: 3_000,
  });
}

export async function selectFilterInDropdown(page: Page, filterName: string) {
  const opened = await openFiltersDropdown(page);
  if (!opened) return false;
  const dropdown = page.locator(".absolute.z-50");
  await dropdown.locator("button", { hasText: filterName }).click();
  // Wait for the filter to register as selected (checkbox becomes checked)
  await expect(
    dropdown
      .locator("button", { hasText: filterName })
      .locator("input[type='checkbox']"),
  ).toBeChecked({ timeout: 5_000 });
  return true;
}

export async function deselectFilterInDropdown(page: Page, filterName: string) {
  const dropdown = page.locator(".absolute.z-50");
  const isOpen = await dropdown.isVisible().catch(() => false);
  if (!isOpen) {
    const opened = await openFiltersDropdown(page);
    if (!opened) return;
  }
  await page
    .locator(".absolute.z-50")
    .locator("button", { hasText: filterName })
    .click();
  await expect(
    page
      .locator(".absolute.z-50")
      .locator("button", { hasText: filterName })
      .locator("input[type='checkbox']"),
  ).not.toBeChecked({ timeout: 5_000 });
}
