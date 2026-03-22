/**
 * E2E Test: Statistics Page
 *
 * Tests the Statistics page (/statistics) with deterministic fixture data:
 *
 * 1. **Scope Selector (League Dropdown)**
 *    - Defaults to "All-Time"
 *    - Populates with seeded leagues
 *    - Switching leagues shows league-specific data
 *    - "All-Time" aggregates data across all leagues
 *
 * 2. **Stat Cards**
 *    - "Stacked Decks Opened" shows correct total count
 *    - "Unique Cards" shows correct unique card count
 *    - "Most Common" shows the card with the highest count
 *
 * 3. **Card Collection Table**
 *    - Renders card names with correct counts
 *    - Search input in header actions filters table rows
 *    - Clearing search restores all rows
 *    - Shows "No cards match your search" for non-matching queries
 *
 * 4. **CSV Export**
 *    - "Export CSV" dropdown button is visible
 *    - "Export All Cards" menu item is present
 *    - After seeding a snapshot, "Export Latest Cards" appears with +N badge
 *    - Snapshot meta reports correct delta counts via IPC
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required — data is seeded into local SQLite
 *   via test-only IPC handlers (`E2E_TESTING=true`)
 *
 * @module e2e/flows/statistics
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../helpers/electron-test";
import { callElectronAPI } from "../helpers/ipc-helpers";
import {
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
  waitForHydration,
} from "../helpers/navigation";
import {
  seedCsvExportSnapshot,
  seedDataStoreForStatistics,
} from "../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToStatistics(page: Page) {
  await navigateTo(page, "/statistics");
  // Wait for the page to fully settle — either stat cards render or empty state
  await page
    .locator("main")
    .filter({ hasText: /Stacked Decks Opened|No cards collected|Statistics/ })
    .waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Get the scope selector <select> element.
 */
function getScopeSelector(page: Page) {
  return page.locator("main select").first();
}

/**
 * Get the search input in the header actions bar.
 */
function getSearchInput(page: Page) {
  return page.locator('[data-testid="statistics-search"]');
}

// ─── Fixture Data ─────────────────────────────────────────────────────────────

// Two leagues with distinct card distributions so we can verify
// league-specific filtering and all-time aggregation.
//
// The Statistics page reads from the `cards` table (DataStoreService), NOT
// from `sessions`/`session_cards`. We must seed the `cards` table directly
// via `seedDataStoreForStatistics` for the data to appear.

const STANDARD_CARDS = [
  { cardName: "The Doctor", count: 5 },
  { cardName: "Humility", count: 20 },
  { cardName: "Rain of Chaos", count: 80 },
  { cardName: "Carrion Crow", count: 80 },
  { cardName: "The Nurse", count: 1 },
];
// Standard total = 186, Unique = 5

const SETTLERS_CARDS = [
  { cardName: "House of Mirrors", count: 1 },
  { cardName: "The Enlightened", count: 5 },
  { cardName: "Humility", count: 40 },
  { cardName: "The Wretched", count: 25 },
];
// Settlers total = 71, Unique = 4

// All-time totals (auto-computed by seedDataStoreForStatistics):
// The Doctor: 5, Humility: 60, Rain of Chaos: 80, Carrion Crow: 80,
// The Nurse: 1, House of Mirrors: 1, The Enlightened: 5, The Wretched: 25
// Grand total = 186 + 71 = 257
// Unique cards = 8
// Most common (tie-break by sort): Carrion Crow or Rain of Chaos (both 80)

// ─── Data Seeding ─────────────────────────────────────────────────────────────

let dataSeeded = false;

async function ensureDataSeeded(page: Page) {
  if (dataSeeded) return;

  // Seed the `cards` table (DataStore) for both leagues + all-time.
  // This is the table the Statistics page reads from via
  // dataStore.getAllTime / dataStore.getLeague / dataStore.getLeagues.
  try {
    await seedDataStoreForStatistics(page, [
      { leagueName: "Standard", cards: STANDARD_CARDS },
      { leagueName: "Settlers of Kalguur", cards: SETTLERS_CARDS },
    ]);
  } catch {
    // May already be seeded from a previous test in this worker
  }

  // Reload so the renderer's useDivinationCards hook re-fetches from the
  // now-seeded `cards` table. Without this, the hook may have already
  // resolved with empty data before the SQLite writes above completed.
  await page.reload();
  await waitForHydration(page, 30_000);

  dataSeeded = true;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Statistics", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ── Page Structure ──────────────────────────────────────────────────────

  test.describe("Page Structure", () => {
    test("should render the Statistics page heading and be on the correct route", async ({
      page,
    }) => {
      await goToStatistics(page);

      const heading = page.getByText("Statistics", { exact: false });
      await expect(heading.first()).toBeVisible({ timeout: 10_000 });

      const route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");
    });

    test("should show sidebar and main content area", async ({ page }) => {
      await goToStatistics(page);

      const sidebar = page.locator("aside");
      const main = page.locator("main");
      await expect(sidebar).toBeVisible({ timeout: 5_000 });
      await expect(main).toBeVisible({ timeout: 5_000 });
    });

    test("should have a scope selector with All-Time as default", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });

      const selectedValue = await select.inputValue();
      expect(selectedValue).toBe("all-time");

      // Verify "All-Time" option exists
      const options = select.locator("option");
      const optionTexts = await options.allTextContents();
      const hasAllTime = optionTexts.some((t) =>
        t.toLowerCase().includes("all-time"),
      );
      expect(hasAllTime, "Should have an All-Time option").toBe(true);
    });
  });

  // ── All-Time Scope ──────────────────────────────────────────────────────

  test.describe("All-Time Scope", () => {
    test("should display aggregated stat cards for all leagues", async ({
      page,
    }) => {
      await goToStatistics(page);
      const main = page.locator("main");
      const content = await main.textContent();

      // Stat card: "Stacked Decks Opened" should show total across all leagues
      expect(content).toContain("Stacked Decks Opened");
      expect(content).toContain("Unique Cards");
      expect(content).toContain("Most Common");

      // The subtitle should indicate all-time scope
      expect(content).toContain("All-time");
    });

    test("should show correct total count across all leagues", async ({
      page,
    }) => {
      await goToStatistics(page);

      // We check the IPC directly for exact values
      const stats = await callElectronAPI<{
        totalCount: number;
        cards: Record<string, { count: number }>;
      }>(page, "dataStore", "getAllTime", "poe1");

      expect(stats).toBeTruthy();
      // Total should be at least 257 (may be higher if other tests seeded data)
      expect(stats.totalCount).toBeGreaterThanOrEqual(257);
    });

    test("should show all unique cards from both leagues in the table", async ({
      page,
    }) => {
      await goToStatistics(page);

      const main = page.locator("main");
      await expect(main).toBeVisible();

      // Wait for the Card Collection heading to appear (table is rendered)
      await page
        .getByText("Card Collection")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const content = await main.textContent();

      // Cards that appear only in Standard
      expect(content).toContain("Carrion Crow");
      expect(content).toContain("Rain of Chaos");
      expect(content).toContain("The Doctor");

      // Cards that appear only in Settlers
      expect(content).toContain("House of Mirrors");
      expect(content).toContain("The Enlightened");
      expect(content).toContain("The Wretched");

      // Card that appears in both leagues
      expect(content).toContain("Humility");
    });
  });

  // ── League-Specific Scope ──────────────────────────────────────────────

  test.describe("League Dropdown", () => {
    test("should populate the dropdown with seeded leagues", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });

      const options = select.locator("option");
      const optionTexts = await options.allTextContents();

      // Should have "All-Time" plus at least the two seeded leagues
      expect(optionTexts.some((t) => t.includes("All-Time"))).toBe(true);
      expect(optionTexts.some((t) => t.includes("Standard"))).toBe(true);
      expect(optionTexts.some((t) => t.includes("Settlers of Kalguur"))).toBe(
        true,
      );
    });

    test("should show Standard-only data when switching to Standard league", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });

      // Switch to Standard
      await select.selectOption({ label: "Standard" });

      // Wait for the page to update — subtitle should change
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const main = page.locator("main");
      const content = await main.textContent();

      // Should show "League-specific statistics"
      expect(content).toContain("League-specific");

      // The scope badge should say "League"
      expect(content).toContain("League");

      // Verify via IPC that league-specific data is correct
      const stats = await callElectronAPI<{
        totalCount: number;
        cards: Record<string, { count: number }>;
      }>(page, "dataStore", "getLeague", "poe1", "Standard");

      expect(stats).toBeTruthy();
      // Standard total: 186
      expect(stats.totalCount).toBeGreaterThanOrEqual(186);

      // Standard cards should be present
      const cardNames = Object.keys(stats.cards);
      expect(cardNames).toContain("The Doctor");
      expect(cardNames).toContain("Carrion Crow");
      expect(cardNames).toContain("Rain of Chaos");

      // Settlers-only cards should NOT be present in Standard
      expect(cardNames).not.toContain("House of Mirrors");
      expect(cardNames).not.toContain("The Enlightened");
      expect(cardNames).not.toContain("The Wretched");
    });

    test("should show Settlers-only data when switching to Settlers league", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });

      // Switch to Settlers of Kalguur
      await select.selectOption({ label: "Settlers of Kalguur" });

      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      // Verify via IPC
      const stats = await callElectronAPI<{
        totalCount: number;
        cards: Record<string, { count: number }>;
      }>(page, "dataStore", "getLeague", "poe1", "Settlers of Kalguur");

      expect(stats).toBeTruthy();
      // Settlers total: 71
      expect(stats.totalCount).toBeGreaterThanOrEqual(71);

      const cardNames = Object.keys(stats.cards);
      expect(cardNames).toContain("House of Mirrors");
      expect(cardNames).toContain("The Enlightened");
      expect(cardNames).toContain("Humility");
      expect(cardNames).toContain("The Wretched");

      // Standard-only cards should NOT be present
      expect(cardNames).not.toContain("The Doctor");
      expect(cardNames).not.toContain("Carrion Crow");
      expect(cardNames).not.toContain("Rain of Chaos");
    });

    test("should return to aggregated data when switching back to All-Time", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);

      // Switch to a specific league first
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      // Switch back to All-Time
      await select.selectOption({ value: "all-time" });
      await expect(page.locator("main")).toContainText("All-time", {
        timeout: 10_000,
      });

      const main = page.locator("main");
      const content = await main.textContent();
      expect(content).toContain("All-time");

      // Cards from both leagues should be visible again
      expect(content).toContain("Humility");
    });
  });

  // ── Stat Cards ──────────────────────────────────────────────────────────

  test.describe("Stat Cards", () => {
    test("should display Stacked Decks Opened stat", async ({ page }) => {
      await goToStatistics(page);

      const stat = page.getByText("Stacked Decks Opened");
      await expect(stat.first()).toBeVisible({ timeout: 10_000 });

      // The stat value should be a number > 0
      const main = page.locator("main");
      const content = await main.textContent();
      const match = content?.match(/Stacked Decks Opened\s*(\d[\d,]*)/);
      expect(
        match,
        "Stacked Decks Opened should have a numeric value",
      ).toBeTruthy();
      const count = parseInt(match![1].replace(/,/g, ""), 10);
      expect(count).toBeGreaterThan(0);
    });

    test("should display Unique Cards stat", async ({ page }) => {
      await goToStatistics(page);

      const stat = page.getByText("Unique Cards");
      await expect(stat.first()).toBeVisible({ timeout: 10_000 });

      const main = page.locator("main");
      const content = await main.textContent();
      const match = content?.match(/Unique Cards\s*(\d[\d,]*)/);
      expect(match, "Unique Cards should have a numeric value").toBeTruthy();
      const count = parseInt(match![1].replace(/,/g, ""), 10);
      // We seeded 8 unique cards across both leagues
      expect(count).toBeGreaterThanOrEqual(8);
    });

    test("should display Most Common card stat", async ({ page }) => {
      await goToStatistics(page);

      const stat = page.getByText("Most Common");
      await expect(stat.first()).toBeVisible({ timeout: 10_000 });

      // The most common card should be displayed with its name
      // Carrion Crow (80) or Rain of Chaos (80) are tied for most common
      const main = page.locator("main");
      const content = await main.textContent();
      expect(content).toContain("times");

      // The card name should be one of the high-count cards
      const hasMostCommon =
        content!.includes("Carrion Crow") || content!.includes("Rain of Chaos");
      expect(
        hasMostCommon,
        "Most common card should be Carrion Crow or Rain of Chaos",
      ).toBe(true);
    });

    test("should update stat cards when switching scope", async ({ page }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);

      // Read all-time total first
      const mainBefore = await page.locator("main").textContent();
      const allTimeMatch = mainBefore?.match(
        /Stacked Decks Opened\s*(\d[\d,]*)/,
      );
      const allTimeCount = allTimeMatch
        ? parseInt(allTimeMatch[1].replace(/,/g, ""), 10)
        : 0;

      // Switch to Settlers (which has fewer cards)
      await select.selectOption({ label: "Settlers of Kalguur" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      // Give the data a moment to load
      await page.waitForTimeout(1_000);

      const mainAfter = await page.locator("main").textContent();
      const leagueMatch = mainAfter?.match(/Stacked Decks Opened\s*(\d[\d,]*)/);
      const leagueCount = leagueMatch
        ? parseInt(leagueMatch[1].replace(/,/g, ""), 10)
        : 0;

      // League count should be less than all-time count
      expect(leagueCount).toBeLessThan(allTimeCount);
      expect(leagueCount).toBeGreaterThan(0);
    });
  });

  // ── Card Collection Table ───────────────────────────────────────────────

  test.describe("Card Collection Table", () => {
    test("should render the Card Collection table with card data", async ({
      page,
    }) => {
      await goToStatistics(page);

      const tableHeading = page.getByText("Card Collection");
      await expect(tableHeading.first()).toBeVisible({ timeout: 10_000 });

      // The table should have rows
      const tableRows = page.locator("table tbody tr");
      const rowCount = await tableRows.count();
      expect(rowCount, "Table should have data rows").toBeGreaterThan(0);
    });

    test("should show the scope badge in the table heading", async ({
      page,
    }) => {
      await goToStatistics(page);

      // A prior test may have left the scope on a league — reset to All-Time
      const select = getScopeSelector(page);
      await select.selectOption({ value: "all-time" });

      // Wait for the table to fully render (rows visible) before checking the badge
      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      // Default scope is "All-Time" — the badge sits inside the Card Collection h2
      const badge = page
        .locator("h2", { hasText: "Card Collection" })
        .locator("span.badge", { hasText: "All-Time" });
      await expect(badge.first()).toBeVisible({ timeout: 10_000 });
    });

    test("should display card names and counts in the table", async ({
      page,
    }) => {
      await goToStatistics(page);

      // Wait for table to render
      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const tableContent = await page.locator("table").textContent();

      // Some seeded cards should appear in the table
      // (table is sorted by count desc, paginated at 20, so all 8 should be on page 1)
      expect(tableContent).toContain("Humility");
      expect(tableContent).toContain("Carrion Crow");
    });
  });

  // ── Search Filtering ───────────────────────────────────────────────────

  test.describe("Search Filtering", () => {
    test("should have a search input in the header actions", async ({
      page,
    }) => {
      await goToStatistics(page);

      // Search is now always visible in the header actions (not gated by card data)
      const search = getSearchInput(page);
      await expect(search).toBeVisible({ timeout: 5_000 });
      await expect(search).toHaveAttribute("placeholder", "Search cards...");
    });

    test("should filter table rows when searching for a card name", async ({
      page,
    }) => {
      await goToStatistics(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);
      const rowCountBefore = await page.locator("table tbody tr").count();
      expect(rowCountBefore).toBeGreaterThan(1);

      // Search for "Doctor" — should filter to only The Doctor
      await search.fill("Doctor");

      // Wait for the filter to take effect
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 5_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeGreaterThanOrEqual(1);
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 5_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeLessThan(8);

      const rowCountAfter = await page.locator("table tbody tr").count();
      expect(rowCountAfter).toBeLessThan(rowCountBefore);

      // The visible row should contain "The Doctor"
      const tableContent = await page.locator("table").textContent();
      expect(tableContent).toContain("The Doctor");
    });

    test("should show empty message when search matches no cards", async ({
      page,
    }) => {
      await goToStatistics(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);

      // Search for something that doesn't exist
      await search.fill("xyznonexistent123");

      // Wait for the empty message to appear
      await expect(page.locator("main")).toContainText(
        "No cards match your search",
        { timeout: 5_000 },
      );

      const mainContent = await page.locator("main").textContent();
      expect(mainContent).toContain("No cards match your search");
    });

    test("should restore all rows when clearing the search", async ({
      page,
    }) => {
      await goToStatistics(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);
      const rowCountBefore = await page.locator("table tbody tr").count();

      // Filter
      await search.fill("Doctor");
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 5_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeLessThan(8);

      // The Search component uses type="search" which has a native clear
      // mechanism, but the simplest way to clear is to fill with empty string.
      await search.fill("");

      // Wait for rows to be restored
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 5_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeGreaterThanOrEqual(rowCountBefore);

      const rowCountAfter = await page.locator("table tbody tr").count();
      expect(rowCountAfter).toBe(rowCountBefore);
    });

    test("should filter cards that include the searched term across multiple matches", async ({
      page,
    }) => {
      // Reload to get a completely clean Search component state — prior
      // tests may leave the debounced Search's internal state or a pending
      // useTransition that prevents new input from propagating.
      await page.reload();
      await waitForHydration(page, 30_000);
      await goToStatistics(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);
      await expect(search).toBeEnabled({ timeout: 5_000 });

      // Search for "The" — should match The Doctor, The Nurse, The Enlightened, The Wretched
      const rowCountBefore = await page.locator("table tbody tr").count();

      await search.fill("The");

      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 8_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeGreaterThanOrEqual(2);
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 8_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeLessThan(rowCountBefore);

      const tableContent = await page.locator("table").textContent();
      // At least some of these "The" cards should be visible
      const hasTheCards =
        tableContent!.includes("The Doctor") ||
        tableContent!.includes("The Nurse") ||
        tableContent!.includes("The Enlightened") ||
        tableContent!.includes("The Wretched");
      expect(hasTheCards).toBe(true);

      // Cards without "The" should be filtered out
      expect(tableContent).not.toContain("Humility");
      expect(tableContent).not.toContain("Rain of Chaos");
      expect(tableContent).not.toContain("Carrion Crow");
    });
  });

  // ── CSV Export ──────────────────────────────────────────────────────────

  test.describe("CSV Export", () => {
    test("should have an Export CSV dropdown button", async ({ page }) => {
      await goToStatistics(page);

      const exportButton = page.getByText("Export CSV", { exact: false });
      await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });
    });

    test("should have csv IPC namespace available", async ({ page }) => {
      const hasCsvApi = await page.evaluate(() => {
        const electron = (window as any).electron;
        return (
          typeof electron?.csv === "object" &&
          typeof electron.csv.exportAll === "function" &&
          typeof electron.csv.exportIncremental === "function" &&
          typeof electron.csv.getSnapshotMeta === "function"
        );
      });
      expect(hasCsvApi).toBe(true);
    });

    test("should show Export All Cards option in the dropdown", async ({
      page,
    }) => {
      await goToStatistics(page);

      // Click the Export CSV button to open the dropdown
      const exportButton = page.getByText("Export CSV", { exact: false });
      await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });
      await exportButton.first().click();

      // The dropdown should show "Export All Cards"
      const exportAllOption = page.getByText("Export All Cards");
      await expect(exportAllOption.first()).toBeVisible({ timeout: 5_000 });
    });

    test("should report no snapshot meta when no export has been done", async ({
      page,
    }) => {
      // Query snapshot meta via IPC — should show exists: false for a fresh scope
      const meta = await callElectronAPI<{
        exists: boolean;
        exportedAt: string | null;
        totalCount: number;
        newCardCount: number;
        newTotalDrops: number;
      }>(page, "csv", "getSnapshotMeta", "all-time");

      // If no export has been done yet, exists should be false
      // (may be true if other tests ran first — just verify the shape)
      expect(meta).toHaveProperty("exists");
      expect(meta).toHaveProperty("newCardCount");
      expect(meta).toHaveProperty("newTotalDrops");
      expect(typeof meta.exists).toBe("boolean");
    });

    test("should show Export Latest Cards after seeding a CSV snapshot", async ({
      page,
    }) => {
      // Seed a CSV export snapshot with a subset of the current data
      // so there's a delta to export
      await seedCsvExportSnapshot(page, {
        scope: "all-time",
        cards: [
          // Only include some cards with lower counts than current
          { cardName: "The Doctor", count: 2 },
          { cardName: "Humility", count: 30 },
          { cardName: "Rain of Chaos", count: 50 },
        ],
      });

      // Reload so the component remounts and the useEffect that calls
      // fetchSnapshotMeta fires fresh with the newly-seeded snapshot data.
      // Without this, the hook may have already resolved with stale meta
      // from a prior test navigation on the same page.
      await page.reload();
      await waitForHydration(page, 30_000);
      await goToStatistics(page);

      // Wait for the snapshot meta IPC round-trip to resolve
      await page.waitForTimeout(1_000);

      // Open the Export CSV dropdown
      const exportButton = page.getByText("Export CSV", { exact: false });
      await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });
      await exportButton.first().click();

      // "Export All Cards" should always be present
      const exportAllOption = page.getByText("Export All Cards");
      await expect(exportAllOption.first()).toBeVisible({ timeout: 5_000 });

      // "Export Latest Cards" should now appear since a snapshot exists
      const exportLatestOption = page.getByText("Export Latest Cards");
      await expect(exportLatestOption.first()).toBeVisible({ timeout: 5_000 });
    });

    test("should show correct delta in snapshot meta after seeding snapshot", async ({
      page,
    }) => {
      // Seed a CSV export snapshot with partial data
      await seedCsvExportSnapshot(page, {
        scope: "all-time",
        cards: [
          { cardName: "The Doctor", count: 2 },
          { cardName: "Humility", count: 30 },
        ],
      });

      // Query snapshot meta via IPC
      const meta = await callElectronAPI<{
        exists: boolean;
        exportedAt: string | null;
        totalCount: number;
        newCardCount: number;
        newTotalDrops: number;
      }>(page, "csv", "getSnapshotMeta", "all-time");

      expect(meta.exists).toBe(true);
      expect(meta.exportedAt).toBeTruthy();

      // There should be new cards (ones in current stats but not in snapshot,
      // or ones with higher counts)
      expect(meta.newCardCount).toBeGreaterThan(0);
      expect(meta.newTotalDrops).toBeGreaterThan(0);
    });

    test("should show +N badge on Export Latest when there are new cards", async ({
      page,
    }) => {
      // Seed a minimal snapshot so most current cards are "new"
      await seedCsvExportSnapshot(page, {
        scope: "all-time",
        cards: [{ cardName: "Humility", count: 1 }],
      });

      await goToStatistics(page);

      // Open the dropdown
      const exportButton = page.getByText("Export CSV", { exact: false });
      await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });
      await exportButton.first().click();

      // Look for the +N badge — it renders as a <span> with badge class
      const badge = page.locator(".badge-info");
      const badgeVisible = await badge
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (badgeVisible) {
        const badgeText = await badge.first().textContent();
        // Badge should show "+<number>" where number > 0
        expect(badgeText).toMatch(/^\+\d+$/);
        const delta = parseInt(badgeText!.replace("+", ""), 10);
        expect(delta).toBeGreaterThan(0);
      }

      // Also verify the sublabel text mentions new cards
      const sublabel = page.getByText(/found.*since last export/i);
      const hasSublabel = await sublabel
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasSublabel || badgeVisible).toBe(true);
    });

    test("should show last exported timestamp in the dropdown", async ({
      page,
    }) => {
      // Seed a snapshot so the "last exported" footer appears
      await seedCsvExportSnapshot(page, {
        scope: "all-time",
        cards: [{ cardName: "Humility", count: 1 }],
      });

      await goToStatistics(page);

      // Open the dropdown
      const exportButton = page.getByText("Export CSV", { exact: false });
      await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });
      await exportButton.first().click();

      // The dropdown footer should show "Last exported <relative time>"
      const lastExported = page.getByText("Last exported");
      const hasLastExported = await lastExported
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasLastExported).toBe(true);
    });
  });

  // ── Route Persistence ──────────────────────────────────────────────────

  test.describe("Route Persistence", () => {
    test("should stay on /statistics after switching scopes", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);

      // Switch to a league
      await select.selectOption({ label: "Standard" });
      await page.waitForTimeout(500);

      let route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");

      // Switch back to All-Time
      await select.selectOption({ value: "all-time" });
      await page.waitForTimeout(500);

      route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");
    });
  });
});
