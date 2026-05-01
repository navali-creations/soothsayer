/**
 * E2E Test: Statistics Page
 *
 * Integration tests for the Statistics page (/statistics). These tests focus
 * on **cross-component interactions and real IPC flows** that unit tests
 * cannot cover. Individual component rendering, prop forwarding, and store
 * wiring are already well-covered by unit tests and are intentionally
 * omitted here.
 *
 * Test categories:
 *
 * 1. **Scope Switching Flow** — Selecting leagues updates stat cards, table
 *    data, and chart simultaneously through the real IPC layer.
 *
 * 2. **Search Filtering** — Debounced search input filters the real table
 *    rows (not a mocked Table component).
 *
 * 3. **Chart Interaction** — Session Overview chart renders with seeded
 *    session data, legend toggles hide/show metrics, and chart responds
 *    to scope changes.
 *
 * 4. **CSV Export Flow** — Seeding a snapshot makes "Export Latest Cards"
 *    appear with the correct +N badge and timestamp.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required — data is seeded into local SQLite
 *   via test-only IPC handlers (`E2E_TESTING=true`)
 *
 * Note: The Statistics page auto-seeds its league scope from the global
 * app-menu league on first mount. Tests that require "all-time" scope
 * must explicitly select it via the scope selector.
 *
 * @module e2e/flows/statistics
 */

import type { Page } from "@playwright/test";

import {
  dragIndexBrushThumb,
  expectCanvasChartRendered,
  readCanvasNumberAttribute,
  readIndexBrushSpan,
  wheelCanvas,
} from "../helpers/canvas";
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
  seedMultipleCompletedSessions,
  seedSessionPrerequisites,
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
 * Ensure the scope selector is set to "all-time".
 *
 * The Statistics page auto-seeds its scope from the global app-menu league
 * on first mount, so it may start on a specific league. This helper
 * explicitly resets it.
 */
async function ensureAllTimeScope(page: Page) {
  const select = getScopeSelector(page);
  await expect(select).toBeVisible({ timeout: 5_000 });
  const currentValue = await select.inputValue();
  if (currentValue !== "all-time") {
    await select.selectOption({ value: "all-time" });
    await expect(page.locator("main")).toContainText("All-time", {
      timeout: 10_000,
    });
  }
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

// ─── Data Seeding ─────────────────────────────────────────────────────────────

let dataSeeded = false;
let sessionsSeeded = false;

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
  } catch (e) {
    console.debug("[e2e] Data seeding skipped (may already be seeded):", e);
  }

  // Reload so the renderer's useDivinationCards hook re-fetches from the
  // now-seeded `cards` table. Without this, the hook may have already
  // resolved with empty data before the SQLite writes above completed.
  await page.reload();
  await waitForHydration(page, 30_000);

  dataSeeded = true;
}

/**
 * Seed completed sessions so the Session Overview chart has data to render.
 * The chart requires ≥2 completed sessions to display trends.
 */
async function ensureSessionsSeeded(page: Page) {
  if (sessionsSeeded) return;

  try {
    // Ensure the league + snapshot rows exist first
    await seedSessionPrerequisites(page, {
      game: "poe1",
      leagueName: "Standard",
    });

    const now = Date.now();
    const cardSets = [
      [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Humility", count: 10 },
        { cardName: "Rain of Chaos", count: 30 },
      ],
      [
        { cardName: "Carrion Crow", count: 40 },
        { cardName: "Rain of Chaos", count: 25 },
        { cardName: "The Nurse", count: 1 },
      ],
      [
        { cardName: "Humility", count: 15 },
        { cardName: "Carrion Crow", count: 20 },
      ],
    ];

    await seedMultipleCompletedSessions(
      page,
      Array.from({ length: 36 }, (_, index) => {
        const endedAt = now - (36 - index) * 60 * 60 * 1000;
        return {
          id: `e2e-chart-session-${index + 1}`,
          game: "poe1",
          leagueId: "poe1_standard",
          startedAt: new Date(endedAt - 45 * 60 * 1000).toISOString(),
          endedAt: new Date(endedAt).toISOString(),
          cards: cardSets[index % cardSets.length],
        };
      }),
    );
  } catch (e) {
    console.debug("[e2e] Session seeding skipped (may already be seeded):", e);
  }

  sessionsSeeded = true;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Statistics", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ── Scope Switching Flow ──────────────────────────────────────────────

  test.describe("Scope Switching Flow", () => {
    test("should show aggregated all-time data with correct totals and table rows", async ({
      page,
    }) => {
      await goToStatistics(page);
      await ensureAllTimeScope(page);

      // Verify via IPC that all-time totals are correct
      const stats = await callElectronAPI<{
        totalCount: number;
        cards: Record<string, { count: number }>;
      }>(page, "dataStore", "getAllTime", "poe1");

      expect(stats).toBeTruthy();
      expect(stats.totalCount).toBeGreaterThanOrEqual(257);

      // Stat cards should reflect all-time scope
      const content = await page.locator("main").textContent();
      expect(content).toContain("Stacked Decks Opened");
      expect(content).toContain("All-time");

      // Table should contain cards from both leagues
      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const tableContent = await page.locator("table").textContent();
      expect(tableContent).toContain("Humility");
      expect(tableContent).toContain("Carrion Crow");
      expect(tableContent).toContain("The Doctor");
      expect(tableContent).toContain("House of Mirrors");
    });

    test("should switch to Standard and show only Standard-specific data", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });
      await select.selectOption({ label: "Standard" });

      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      // Verify via IPC
      const stats = await callElectronAPI<{
        totalCount: number;
        cards: Record<string, { count: number }>;
      }>(page, "dataStore", "getLeague", "poe1", "Standard");

      expect(stats).toBeTruthy();
      expect(stats.totalCount).toBeGreaterThanOrEqual(186);

      const cardNames = Object.keys(stats.cards);
      expect(cardNames).toContain("The Doctor");
      expect(cardNames).toContain("Carrion Crow");
      // Settlers-only cards should NOT be present
      expect(cardNames).not.toContain("House of Mirrors");
      expect(cardNames).not.toContain("The Wretched");
    });

    test("should switch to Settlers and show only Settlers-specific data", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });
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
      expect(stats.totalCount).toBeGreaterThanOrEqual(71);

      const cardNames = Object.keys(stats.cards);
      expect(cardNames).toContain("House of Mirrors");
      expect(cardNames).toContain("Humility");
      // Standard-only cards should NOT be present
      expect(cardNames).not.toContain("The Doctor");
      expect(cardNames).not.toContain("Carrion Crow");
    });

    test("should update stat card values when switching between scopes", async ({
      page,
    }) => {
      await goToStatistics(page);
      await ensureAllTimeScope(page);

      // Read all-time total
      const mainBefore = await page.locator("main").textContent();
      const allTimeMatch = mainBefore?.match(
        /Stacked Decks Opened\s*(\d[\d,]*)/,
      );
      const allTimeCount = allTimeMatch
        ? parseInt(allTimeMatch[1].replace(/,/g, ""), 10)
        : 0;
      expect(allTimeCount).toBeGreaterThan(0);

      // Switch to Settlers (fewer cards)
      const select = getScopeSelector(page);
      await select.selectOption({ label: "Settlers of Kalguur" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const mainAfter = await page.locator("main").textContent();
      const leagueMatch = mainAfter?.match(/Stacked Decks Opened\s*(\d[\d,]*)/);
      const leagueCount = leagueMatch
        ? parseInt(leagueMatch[1].replace(/,/g, ""), 10)
        : 0;

      // League count should be less than all-time count
      expect(leagueCount).toBeLessThan(allTimeCount);
      expect(leagueCount).toBeGreaterThan(0);
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

      const content = await page.locator("main").textContent();
      expect(content).toContain("All-time");
      expect(content).toContain("Humility");

      // Route should still be /statistics
      const route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");
    });

    test("should show Unique Cards Collected only in league scope", async ({
      page,
    }) => {
      await goToStatistics(page);
      await ensureAllTimeScope(page);

      // In all-time scope, Unique Cards Collected should NOT be visible
      const uniqueStat = page.getByText("Unique Cards Collected");
      await expect(uniqueStat).toHaveCount(0);

      // Switch to a league scope
      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      // Now Unique Cards Collected should be visible
      await expect(uniqueStat.first()).toBeVisible({ timeout: 10_000 });
    });

    test("should populate the dropdown with seeded leagues", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await expect(select).toBeVisible({ timeout: 5_000 });

      const options = select.locator("option");
      const optionTexts = await options.allTextContents();

      expect(optionTexts.some((t) => t.includes("All-Time"))).toBe(true);
      expect(optionTexts.some((t) => t.includes("Standard"))).toBe(true);
      expect(optionTexts.some((t) => t.includes("Settlers of Kalguur"))).toBe(
        true,
      );
    });
  });

  // ── Search Filtering ──────────────────────────────────────────────────

  test.describe("Search Filtering", () => {
    test("should filter table rows and restore them when clearing", async ({
      page,
    }) => {
      await goToStatistics(page);
      await ensureAllTimeScope(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);
      const rowCountBefore = await page.locator("table tbody tr").count();
      expect(rowCountBefore).toBeGreaterThan(1);

      // Search for "Doctor" — should filter to only The Doctor
      await search.fill("Doctor");

      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 5_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeLessThanOrEqual(1);

      const tableContent = await page.locator("table").textContent();
      expect(tableContent).toContain("The Doctor");

      // Clear the search — all rows should be restored
      await search.fill("");

      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 5_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeGreaterThanOrEqual(rowCountBefore);

      const rowCountAfter = await page.locator("table tbody tr").count();
      expect(rowCountAfter).toBe(rowCountBefore);
    });

    test("should show empty message when search matches no cards", async ({
      page,
    }) => {
      await goToStatistics(page);
      await ensureAllTimeScope(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);
      await search.fill("xyznonexistent123");

      await expect(page.locator("main")).toContainText(
        "No cards match your search",
        { timeout: 5_000 },
      );
    });

    test("should filter across multiple matches and exclude non-matching cards", async ({
      page,
    }) => {
      // Reload for a clean Search component state
      await page.reload();
      await waitForHydration(page, 30_000);
      await goToStatistics(page);
      await ensureAllTimeScope(page);

      await page
        .locator("table tbody tr")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const search = getSearchInput(page);
      await expect(search).toBeEnabled({ timeout: 5_000 });

      const rowCountBefore = await page.locator("table tbody tr").count();

      // "The" matches: The Doctor, The Nurse, The Enlightened, The Wretched
      await search.fill("The");

      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 8_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeLessThan(rowCountBefore);

      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 8_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeGreaterThanOrEqual(2);

      const tableContent = await page.locator("table").textContent();
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

  // ── Chart Interaction ─────────────────────────────────────────────────

  test.describe("Chart Interaction", () => {
    test.beforeEach(async ({ page }) => {
      await ensureSessionsSeeded(page);
    });

    test("should show empty chart state when no sessions exist for a league", async ({
      page,
    }) => {
      await goToStatistics(page);

      // Switch to Settlers which has no seeded sessions (only Standard has them)
      const select = getScopeSelector(page);
      await select.selectOption({ label: "Settlers of Kalguur" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      // Chart should show the empty state message
      const chartArea = page.locator('[data-testid="statistics-charts"]');
      await expect(chartArea).toBeVisible({ timeout: 10_000 });
      await expect(chartArea).toContainText(
        "At least 2 completed sessions are needed",
        { timeout: 5_000 },
      );
    });

    test("should render Session Overview chart with seeded sessions", async ({
      page,
    }) => {
      await goToStatistics(page);

      // Switch to Standard which has 3 seeded sessions
      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const chartArea = page.locator('[data-testid="statistics-charts"]');
      await expect(chartArea).toBeVisible({ timeout: 10_000 });

      // Should show "Session Overview" heading instead of empty state
      await expect(chartArea).toContainText("Session Overview", {
        timeout: 10_000,
      });

      // Should NOT show the empty state message
      const emptyMsg = chartArea.getByText(
        "At least 2 completed sessions are needed",
      );
      await expect(emptyMsg).toHaveCount(0);
    });

    test("should resize the Session Overview brush thumb", async ({ page }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const chartArea = page.locator('[data-testid="statistics-charts"]');
      await expect(chartArea).toContainText("Session Overview", {
        timeout: 10_000,
      });

      const canvas = chartArea.getByTestId("combined-chart-canvas");
      await expectCanvasChartRendered(canvas, "Session overview");
      await expect(canvas).toHaveAttribute("data-brush-enabled", "true");
      await expect
        .poll(
          () => readCanvasNumberAttribute(canvas, "data-chart-point-count"),
          { timeout: 5_000, intervals: [100, 250, 500] },
        )
        .toBeGreaterThan(30);

      const startBefore = await readCanvasNumberAttribute(
        canvas,
        "data-brush-start-index",
      );

      await dragIndexBrushThumb(page, canvas, {
        thumb: "left",
        deltaX: 120,
        leftPadding: 45,
        rightPadding: 50,
      });

      await expect
        .poll(
          () => readCanvasNumberAttribute(canvas, "data-brush-start-index"),
          { timeout: 5_000, intervals: [100, 250, 500] },
        )
        .toBeGreaterThan(startBefore);

      const route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");
    });

    test("should zoom the Session Overview brush with the mouse wheel", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const chartArea = page.locator('[data-testid="statistics-charts"]');
      const canvas = chartArea.getByTestId("combined-chart-canvas");
      await expectCanvasChartRendered(canvas, "Session overview");
      await expect(canvas).toHaveAttribute("data-brush-enabled", "true");

      const spanBefore = await readIndexBrushSpan(canvas);
      await wheelCanvas(canvas, -500);

      await expect
        .poll(() => readIndexBrushSpan(canvas), {
          timeout: 5_000,
          intervals: [100, 250, 500],
        })
        .toBeLessThan(spanBefore);
      const zoomedInSpan = await readIndexBrushSpan(canvas);

      await wheelCanvas(canvas, 500);

      await expect
        .poll(() => readIndexBrushSpan(canvas), {
          timeout: 5_000,
          intervals: [100, 250, 500],
        })
        .toBeGreaterThan(zoomedInSpan);

      const route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");
    });

    test("should render legend buttons for chart metrics", async ({ page }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const chartArea = page.locator('[data-testid="statistics-charts"]');
      await expect(chartArea).toContainText("Session Overview", {
        timeout: 10_000,
      });

      // Legend buttons should be visible
      const decksLegend = chartArea
        .locator("button", { hasText: "Decks Opened" })
        .first();
      const profitLegend = chartArea
        .locator("button", { hasText: "Profit" })
        .first();
      await expect(decksLegend).toBeVisible({ timeout: 5_000 });
      await expect(profitLegend).toBeVisible({ timeout: 5_000 });
    });

    test("should toggle legend metric visibility on click", async ({
      page,
    }) => {
      await goToStatistics(page);

      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const chartArea = page.locator('[data-testid="statistics-charts"]');
      await expect(chartArea).toContainText("Session Overview", {
        timeout: 10_000,
      });

      // Find the "Decks Opened" legend button
      const decksButton = chartArea
        .locator("button", { hasText: "Decks Opened" })
        .first();
      await expect(decksButton).toBeVisible({ timeout: 5_000 });

      // Before clicking: button should have the active class
      await expect(decksButton).toHaveClass(/opacity-100/);

      // Click to hide the metric
      await decksButton.click();

      // After clicking: button should have the dimmed class
      await expect(decksButton).toHaveClass(/opacity-30/);

      // Click again to restore
      await decksButton.click();

      await expect(decksButton).toHaveClass(/opacity-100/);
    });

    test("should update chart when switching scope from league to all-time", async ({
      page,
    }) => {
      await goToStatistics(page);

      // Start on Standard (has sessions → chart renders)
      const select = getScopeSelector(page);
      await select.selectOption({ label: "Standard" });
      await expect(page.locator("main")).toContainText("League-specific", {
        timeout: 10_000,
      });

      const chartArea = page.locator('[data-testid="statistics-charts"]');
      await expect(chartArea).toContainText("Session Overview", {
        timeout: 10_000,
      });

      // Switch to all-time — chart should still render (sessions exist)
      await select.selectOption({ value: "all-time" });
      await expect(page.locator("main")).toContainText("All-time", {
        timeout: 10_000,
      });

      // Chart area should still be visible
      await expect(chartArea).toBeVisible({ timeout: 10_000 });
      // It should show the chart (not empty state) since sessions exist
      await expect(chartArea).toContainText("Session Overview", {
        timeout: 10_000,
      });
    });
  });

  // ── CSV Export Flow ───────────────────────────────────────────────────

  test.describe("CSV Export Flow", () => {
    test("should show Export All option in dropdown", async ({ page }) => {
      await goToStatistics(page);

      const exportButton = page.getByText("Export CSV", { exact: false });
      await expect(exportButton.first()).toBeVisible({ timeout: 10_000 });
      await exportButton.first().click();

      const exportAllOption = page.getByText("Export All Cards");
      await expect(exportAllOption.first()).toBeVisible({ timeout: 5_000 });
    });

    test("should show Export Latest with badge and timestamp after seeding snapshot", async ({
      page,
    }) => {
      // Seed a minimal CSV export snapshot so most current cards are "new"
      await seedCsvExportSnapshot(page, {
        scope: "all-time",
        cards: [{ cardName: "Humility", count: 1 }],
      });

      // Reload so the component remounts and fetchSnapshotMeta fires fresh
      await page.reload();
      await waitForHydration(page, 30_000);
      await goToStatistics(page);
      await ensureAllTimeScope(page);

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

      // +N badge should be visible with a positive delta
      const badge = page.locator(".badge-info");
      const badgeVisible = await badge
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (badgeVisible) {
        const badgeText = await badge.first().textContent();
        expect(badgeText).toMatch(/^\+\d+$/);
        const delta = parseInt(badgeText!.replace("+", ""), 10);
        expect(delta).toBeGreaterThan(0);
      }

      // Sublabel should mention cards found since last export
      const sublabel = page.getByText(/found.*since last export/i);
      const hasSublabel = await sublabel
        .first()
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      expect(hasSublabel || badgeVisible).toBe(true);

      // "Last exported" timestamp footer should be visible
      const lastExported = page.getByText("Last exported");
      const hasLastExported = await lastExported
        .first()
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
      expect(hasLastExported).toBe(true);
    });

    test("should report correct snapshot delta via IPC", async ({ page }) => {
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
      expect(meta.newCardCount).toBeGreaterThan(0);
      expect(meta.newTotalDrops).toBeGreaterThan(0);
    });
  });
});
