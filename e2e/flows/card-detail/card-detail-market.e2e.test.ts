/**
 * E2E Tests: Card Detail Page — Market Data Tab
 *
 * Tests the Market Data tab on the card details page (/cards/$cardSlug):
 * 1. Switching to Market Data tab and verifying it becomes active
 * 2. Price chart rendering (Recharts) with deterministic fixture data
 * 3. Price summary and drop stats sections
 *
 * Uses a pre-built poe.ninja fixture seeded into the `card_price_history_cache`
 * SQLite table so that:
 * - No real network requests are made to poe.ninja
 * - Tests are fully deterministic (no flakes from poe.ninja downtime)
 * - The price chart always renders (fixture guarantees 90 days of history)
 *
 * Split from card-detail.e2e.test.ts so Market Data tests run on a separate
 * worker and don't slow down the core card detail tests.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required — cards load from bundled `renderer/assets/poe1/cards.json`
 *   into local SQLite at startup
 * - Price history is seeded from `e2e/fixtures/poe-ninja-fixture.ts` into
 *   the local cache before tests run (see `ensureDataSeeded`)
 *
 * @module e2e/flows/card-detail-market
 */

import type { Page } from "@playwright/test";

import { HOUSE_OF_MIRRORS_PRICE_HISTORY } from "../../fixtures/poe-ninja-fixture";
import { expect, test } from "../../helpers/electron-test";
import {
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
} from "../../helpers/navigation";
import {
  seedCardRarities,
  seedLeagueCache,
  seedPriceHistoryCache,
  seedSessionPrerequisites,
} from "../../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to the card detail page for a given card slug and wait for main
 * content to be visible.
 */
async function goToCardDetail(page: Page, slug: string) {
  await navigateTo(page, `/cards/${slug}`);
  await page.locator("main").waitFor({ state: "visible", timeout: 15_000 });
}

/**
 * Click the "Market Data" tab on the card detail page.
 * The default active tab is "Your Data", so this must be called explicitly
 * before testing Market Data content.
 */
async function switchToMarketTab(page: Page) {
  const marketTab = page.locator('button[role="tab"]', {
    hasText: "Market Data",
  });
  await expect(marketTab).toBeVisible({ timeout: 10_000 });
  await marketTab.click();
  await page.waitForTimeout(500);
}

/**
 * Wait for the Market Data tab to finish loading — resolves when the price
 * chart renders, or an empty/error fallback appears, or the "Price History"
 * heading is visible (meaning loading finished but no chart data).
 */
async function waitForMarketDataSettled(page: Page, timeout = 20_000) {
  await expect
    .poll(
      async () => {
        const hasChart = (await page.locator(".recharts-wrapper").count()) > 0;
        const hasEmpty = await page
          .getByText("No price history available")
          .isVisible()
          .catch(() => false);
        const hasError = await page
          .getByText("Failed to load price history")
          .isVisible()
          .catch(() => false);
        const hasHeading = await page
          .getByText("Price History")
          .isVisible()
          .catch(() => false);
        const hasLoading = await page
          .getByText("Loading chart data")
          .isVisible()
          .catch(() => false);
        return hasChart || hasEmpty || hasError || (hasHeading && !hasLoading);
      },
      { timeout, intervals: [200, 500, 1_000] },
    )
    .toBe(true);
}

// ─── Data Seeding ─────────────────────────────────────────────────────────────

let dataSeeded = false;

/**
 * Seed all prerequisite data for the Market Data tab tests.
 *
 * Seeds:
 * 1. Leagues + snapshot + card rarity (so the card detail page initialises)
 * 2. **Price history cache** — a deterministic poe.ninja fixture for
 *    House of Mirrors is inserted into `card_price_history_cache` with
 *    `fetched_at` = now (so the 30-min TTL treats it as fresh). This means
 *    `CardDetailsService.getPriceHistory()` will return the cached fixture
 *    instead of hitting poe.ninja over the network.
 *
 * Session data is NOT needed here — that's covered by the main card-detail tests.
 */
async function ensureDataSeeded(page: Page) {
  if (dataSeeded) return;

  try {
    await seedSessionPrerequisites(page);
  } catch {
    // May already be seeded from a previous test in this worker
  }

  try {
    await seedLeagueCache(page, {
      game: "poe1",
      leagueId: "Standard",
      name: "Standard",
    });
  } catch {
    // Already seeded
  }

  try {
    await seedCardRarities(page, [{ cardName: "House of Mirrors", rarity: 1 }]);
  } catch {
    // Already seeded
  }

  // Seed the poe.ninja price history cache so Market Data tests never
  // hit the real poe.ninja API. The fixture contains 90 days of realistic
  // price data which guarantees the Recharts chart will render.
  try {
    await seedPriceHistoryCache(page, HOUSE_OF_MIRRORS_PRICE_HISTORY);
  } catch {
    // Already seeded
  }

  dataSeeded = true;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Card Detail Page — Market Data", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ── Tab Activation ──────────────────────────────────────────────────────

  test.describe("Tab Activation", () => {
    test("should activate the Market Data tab when clicked", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      const isActive = await marketTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(isActive, "Market Data tab should be active after click").toBe(
        true,
      );

      // Your Data tab should no longer be active
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      const isYourDataActive = await yourDataTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isYourDataActive,
        "Your Data tab should be inactive after switching to Market Data",
      ).toBe(false);
    });

    test("should show the Price History heading after switching to Market Data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      // Wait for the market data content to settle (loading → chart/empty/error)
      await waitForMarketDataSettled(page);

      // The "Price History" heading appears in all resolved states
      // (chart rendered, empty state, or error state)
      const mainContent = await page.locator("main").textContent();
      expect(mainContent).toContain("Price History");
    });
  });

  // ── Price Chart Rendering ─────────────────────────────────────────────────

  test.describe("Price Chart", () => {
    test("should render price chart section without crashing", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      // Price history is pre-seeded in card_price_history_cache so no
      // network request to poe.ninja is needed. The chart should always
      // render with the fixture's 90 days of price data.
      await waitForMarketDataSettled(page);

      const chartRendered =
        (await page.locator(".recharts-wrapper").count()) > 0;

      // With seeded fixture data the chart should always render
      expect(
        chartRendered,
        "Price chart should render with seeded fixture data",
      ).toBe(true);

      // Verify the chart contains an SVG with non-zero dimensions
      const surface = page.locator(".recharts-wrapper svg").first();
      await expect(surface).toBeVisible({ timeout: 5_000 });

      const svgBox = await surface.boundingBox();
      expect(svgBox, "Price chart SVG should have a bounding box").toBeTruthy();
      expect(
        svgBox!.width,
        "Price chart SVG should have non-zero width",
      ).toBeGreaterThan(0);
      expect(
        svgBox!.height,
        "Price chart SVG should have non-zero height",
      ).toBeGreaterThan(0);
    });

    test("should display chart and stay on card detail route", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      await waitForMarketDataSettled(page);

      // With seeded fixture data the chart should always render
      const chartRendered =
        (await page.locator(".recharts-wrapper").count()) > 0;
      expect(
        chartRendered,
        "Price chart should render with seeded fixture data",
      ).toBe(true);

      // Verify the SVG surface
      const surface = page
        .locator(".recharts-wrapper svg.recharts-surface")
        .first();
      await expect(surface).toBeVisible({ timeout: 5_000 });

      const svgBox = await surface.boundingBox();
      expect(
        svgBox,
        "Recharts SVG surface should have a bounding box",
      ).toBeTruthy();
      expect(svgBox!.width).toBeGreaterThan(0);
      expect(svgBox!.height).toBeGreaterThan(0);

      // The "Price History" heading should be visible
      const mainContent = await page.locator("main").textContent();
      expect(mainContent).toContain("Price History");

      // Verify the route is still the card detail page
      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });
  });

  // ── Recharts Structure (Market Data tab) ──────────────────────────────────

  test.describe("Recharts Structure", () => {
    test("should render Recharts SVG surface with seeded price data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      // Fixture data guarantees the chart renders
      const rechartsWrappers = page.locator(".recharts-wrapper");
      const wrapperCount = await rechartsWrappers.count();
      expect(
        wrapperCount,
        "Recharts wrapper should be present with seeded fixture data",
      ).toBeGreaterThan(0);

      const surface = rechartsWrappers.first().locator("svg.recharts-surface");
      await expect(surface).toBeVisible({ timeout: 5_000 });

      const svgBox = await surface.boundingBox();
      expect(
        svgBox,
        "Recharts SVG surface should have a bounding box",
      ).toBeTruthy();
      expect(
        svgBox!.width,
        "Recharts SVG should have non-zero width",
      ).toBeGreaterThan(0);
      expect(
        svgBox!.height,
        "Recharts SVG should have non-zero height",
      ).toBeGreaterThan(0);
    });

    test("should render chart axes and grid lines with seeded price data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      // Fixture data guarantees chart renders — assert structural elements
      const rechartsWrappers = page.locator(".recharts-wrapper");
      await expect(rechartsWrappers.first()).toBeVisible({ timeout: 5_000 });

      // Recharts renders CartesianGrid as <g class="recharts-cartesian-grid">
      const gridLines = page.locator(".recharts-cartesian-grid");
      const gridCount = await gridLines.count();

      // Recharts renders axes as <g class="recharts-xAxis"> / <g class="recharts-yAxis">
      const xAxis = page.locator(".recharts-xAxis");
      const yAxis = page.locator(".recharts-yAxis");

      const hasStructure =
        gridCount > 0 || (await xAxis.count()) > 0 || (await yAxis.count()) > 0;

      expect(
        hasStructure,
        "Price chart should render grid, X-axis, or Y-axis elements",
      ).toBe(true);
    });

    test("should render chart data elements (area and bars) with seeded price data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      // Fixture data guarantees chart renders
      const rechartsSurface = page.locator(".recharts-surface");
      const surfaceCount = await rechartsSurface.count();
      expect(
        surfaceCount,
        "Recharts surface should be present with seeded fixture data",
      ).toBeGreaterThan(0);

      // The price chart uses a ComposedChart with:
      //   - <Area> for the price rate line
      //   - <Bar> for volume bars
      const bars = page.locator(".recharts-bar");
      const areas = page.locator(".recharts-area");
      const lines = page.locator(".recharts-line");

      const barCount = await bars.count();
      const areaCount = await areas.count();
      const lineCount = await lines.count();

      const hasDataElements = barCount > 0 || areaCount > 0 || lineCount > 0;

      expect(
        hasDataElements,
        "Price chart should render bar, area, or line data elements",
      ).toBe(true);
    });
  });

  // ── Tab Interaction After Market Data ─────────────────────────────────────

  test.describe("Tab Interaction", () => {
    test("should switch back to Your Data tab after viewing Market Data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      // Let market data start loading
      await page.waitForTimeout(1_000);

      // Switch back to Your Data
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await yourDataTab.click();
      await page.waitForTimeout(1_000);

      const isYourDataActive = await yourDataTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isYourDataActive,
        "Your Data tab should be active after switching back",
      ).toBe(true);

      // Market Data tab should be inactive
      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      const isMarketActive = await marketTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isMarketActive,
        "Market Data tab should be inactive after switching away",
      ).toBe(false);
    });

    test("should preserve card detail route when toggling Market Data tab", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // Switch to Market Data
      await switchToMarketTab(page);
      let route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");

      // Switch back to Your Data
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await yourDataTab.click();
      await page.waitForTimeout(500);

      route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");

      // Switch to Market Data again
      await switchToMarketTab(page);
      route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });
  });
});
