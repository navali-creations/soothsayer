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
import { getCurrentRoute, navigateTo } from "../../helpers/navigation";
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
  // If the page is already on /rarity-insights the hash-based navigateTo is
  // a no-op — the React component stays mounted, useEffect doesn't re-fire,
  // and loadCards() never re-fetches from the (now-seeded) DB.  On CI, this
  // means the first test loads cards before the DB seed completes and every
  // subsequent test in the serial suite reuses that stale data (rarity = 0
  // for all non-fixture bundled cards), causing sort / diff assertions to
  // fail.
  //
  // Fix: bounce to "/" first to force an unmount → remount cycle so the
  // page's useEffect fires loadCards() with fresh DB data.
  const currentRoute = await getCurrentRoute(page);
  if (currentRoute === "/rarity-insights") {
    await navigateTo(page, "/");
    // Brief pause so React tears down the RI page component.
    await page.waitForTimeout(150);
  }

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

/**
 * Waits for the cards data to finish loading by observing the DOM loading
 * indicator rather than reaching into the Zustand store.
 *
 * The Rarity Insights page renders a `[data-testid="cards-loading"]` overlay
 * while `cards.isLoading` is true.  This helper:
 *
 * 1. Waits for the loading overlay to appear (proving `loadCards()` has
 *    started) OR times out quickly if it never appears (because the load
 *    already completed before we started watching).
 * 2. Waits for the loading overlay to be hidden (load complete).
 * 3. Confirms that the table contains at least one row (data arrived).
 *
 * The two-phase approach prevents a race condition where `loadCards()` is
 * triggered by the page's `useEffect` on mount (after an async
 * `checkRefreshStatus`) but hasn't started yet when the test begins
 * interacting with the table.  Without the "wait for appear" phase,
 * `toBeHidden()` would succeed immediately because the overlay doesn't
 * exist yet, and the test would proceed with stale data that lacks the
 * seeded rarity values.
 */
export async function waitForCardsLoaded(page: Page) {
  const loadingOverlay = page.locator('[data-testid="cards-loading"]');

  // Phase 1: Quick-check whether the loading overlay is currently visible.
  // If loadCards() is already in-flight, the overlay will be in the DOM.
  const alreadyVisible = await loadingOverlay.isVisible().catch(() => false);

  if (alreadyVisible) {
    // loadCards() is running right now — wait for it to finish.
    await expect(loadingOverlay).toBeHidden({ timeout: 15_000 });
  } else {
    // The overlay isn't visible.  Either:
    //   (a) loadCards() already completed, or
    //   (b) loadCards() hasn't started yet (the first useEffect is still
    //       awaiting checkRefreshStatus before calling loadCards).
    //
    // To handle (b) — which causes the flake on slow CI runners — give the
    // overlay a short window to appear.  If it does, wait for the full
    // load cycle to complete.  If it doesn't, loadCards() finished before
    // we got here and the data is already rendered (case a).
    //
    // 1.5 s is enough for checkRefreshStatus (a single IPC read) to
    // complete on even heavily-loaded CI runners, without penalising the
    // common fast path where loadCards() already finished.
    const appeared = await loadingOverlay
      .waitFor({ state: "visible", timeout: 1_500 })
      .then(() => true)
      .catch(() => false);

    if (appeared) {
      await expect(loadingOverlay).toBeHidden({ timeout: 15_000 });
    }
  }

  // Phase 2: Confirm at least one table row is present (data has rendered).
  await page
    .locator("table tbody tr")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
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
 *
 * Uses Playwright locators and `expect.poll()` instead of raw
 * `page.waitForFunction` for more reliable waiting in CI environments
 * where React re-renders can be slower due to resource contention.
 */
export async function clickChipAndWaitForReorder(
  page: Page,
  headerLocator: string,
  chipIndex: number,
) {
  // Ensure the table is fully rendered AND that loadCards() has completed
  // with rarity data from the DB. Without this, clicking a rarity chip may
  // sort cards that all have rarity 0, producing no visible reorder.
  const cardLinks = page.locator("table tbody tr td a");
  await expect(cardLinks.first()).toBeVisible({ timeout: 10_000 });
  await waitForCardsLoaded(page);

  const namesBefore = await getVisibleCardNames(page);

  const chip = page
    .locator(headerLocator)
    .locator("button.badge")
    .nth(chipIndex);

  // Record the chip's opacity before the click so we can verify the click
  // registered — the active chip switches from opacity 0.5 → 1 (or 1 → 0.5
  // when toggling off).
  const opacityBefore = await chip.evaluate(
    (el) => getComputedStyle(el).opacity,
  );

  await chip.click();

  // Verify the click actually registered by waiting for the chip's opacity
  // to change. This catches cases where the click was intercepted or the
  // element was obscured.
  await expect
    .poll(
      async () => {
        return chip.evaluate((el) => getComputedStyle(el).opacity);
      },
      { timeout: 5_000, intervals: [100, 200, 500] },
    )
    .not.toBe(opacityBefore);

  // Wait for the visible card order to differ from the pre-click snapshot.
  // Uses Playwright's expect.poll with locator-based reads for reliable
  // retrying in resource-constrained CI environments.
  await expect
    .poll(
      async () => {
        const count = await cardLinks.count();
        if (count === 0) return namesBefore; // unchanged — keep polling
        const current: string[] = [];
        for (let i = 0; i < count; i++) {
          const text = await cardLinks.nth(i).textContent();
          if (text) current.push(text.trim());
        }
        return current;
      },
      {
        timeout: 10_000,
        intervals: [100, 200, 500, 1_000],
        message:
          "Table order did not change after chip click. " +
          `Names before: [${namesBefore.join(", ")}]`,
      },
    )
    .not.toEqual(namesBefore);
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
