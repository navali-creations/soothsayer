/**
 * E2E Tests: Card Detail Page — Market Data Tab
 *
 * Tests the Market Data tab on the card details page (/cards/$cardSlug):
 * 1. Switching to Market Data tab and verifying it becomes active
 * 2. Price chart rendering (canvas) with deterministic fixture data
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
 * - No external services required — cards load from `@navali/poe1-divination-cards` package data
 *   into local SQLite at startup
 * - Price history is seeded from `e2e/fixtures/poe-ninja-fixture.ts` into
 *   the local cache before tests run (see `ensureDataSeeded`)
 *
 * @module e2e/flows/card-detail-market
 */

import type { Page } from "@playwright/test";

import { HOUSE_OF_MIRRORS_PRICE_HISTORY } from "../../fixtures/poe-ninja-fixture";
import {
  dragIndexBrushThumb,
  expectCanvasChartRendered,
  readCanvasNumberAttribute,
  readIndexBrushSpan,
  wheelCanvas,
} from "../../helpers/canvas";
import { expect, test } from "../../helpers/electron-test";
import {
  ensurePostSetup,
  getCurrentRoute,
  goToCardDetail,
} from "../../helpers/navigation";
import {
  seedCardRarities,
  seedLeagueCache,
  seedPriceHistoryCache,
  seedSessionPrerequisites,
} from "../../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  // Wait for the tab to become active instead of using a fixed timeout
  await expect(marketTab).toHaveClass(/tab-active/, { timeout: 5_000 });
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
        const hasChart =
          (await page.getByTestId("price-history-canvas").count()) > 0;
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
  // price data which guarantees the canvas chart will render.
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

      const priceCanvas = page.getByTestId("price-history-canvas");
      const chartRendered = (await priceCanvas.count()) > 0;

      // With seeded fixture data the chart should always render
      expect(
        chartRendered,
        "Price chart should render with seeded fixture data",
      ).toBe(true);

      await expectCanvasChartRendered(priceCanvas, "Price history");
    });

    test("should display chart and stay on card detail route", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      await waitForMarketDataSettled(page);

      // With seeded fixture data the chart should always render
      const priceCanvas = page.getByTestId("price-history-canvas");
      const chartRendered = (await priceCanvas.count()) > 0;
      expect(
        chartRendered,
        "Price chart should render with seeded fixture data",
      ).toBe(true);

      await expectCanvasChartRendered(priceCanvas, "Price history");

      // The "Price History" heading should be visible
      const mainContent = await page.locator("main").textContent();
      expect(mainContent).toContain("Price History");

      // Verify the route is still the card detail page
      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });

    test("should resize the price chart brush thumb", async ({ page }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      const priceCanvas = page.getByTestId("price-history-canvas");
      await expectCanvasChartRendered(priceCanvas, "Price history");
      await expect(priceCanvas).toHaveAttribute("data-brush-enabled", "true");
      await expect
        .poll(
          () =>
            readCanvasNumberAttribute(priceCanvas, "data-chart-point-count"),
          { timeout: 5_000, intervals: [100, 250, 500] },
        )
        .toBeGreaterThan(5);

      const startBefore = await readCanvasNumberAttribute(
        priceCanvas,
        "data-brush-start-index",
      );

      await dragIndexBrushThumb(page, priceCanvas, {
        thumb: "left",
        deltaX: 120,
        leftPadding: 50,
        rightPadding: 50,
      });

      await expect
        .poll(
          () =>
            readCanvasNumberAttribute(priceCanvas, "data-brush-start-index"),
          { timeout: 5_000, intervals: [100, 250, 500] },
        )
        .toBeGreaterThan(startBefore);

      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });

    test("should zoom the price chart brush with the mouse wheel", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      const priceCanvas = page.getByTestId("price-history-canvas");
      await expectCanvasChartRendered(priceCanvas, "Price history");
      await expect(priceCanvas).toHaveAttribute("data-brush-enabled", "true");

      const spanBefore = await readIndexBrushSpan(priceCanvas);
      await wheelCanvas(priceCanvas, -500);

      await expect
        .poll(() => readIndexBrushSpan(priceCanvas), {
          timeout: 5_000,
          intervals: [100, 250, 500],
        })
        .toBeLessThan(spanBefore);
      const zoomedInSpan = await readIndexBrushSpan(priceCanvas);

      await wheelCanvas(priceCanvas, 500);

      await expect
        .poll(() => readIndexBrushSpan(priceCanvas), {
          timeout: 5_000,
          intervals: [100, 250, 500],
        })
        .toBeGreaterThan(zoomedInSpan);

      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });
  });

  // ── Canvas Structure (Market Data tab) ──────────────────────────────────

  test.describe("Canvas Structure", () => {
    test("should render canvas surface with seeded price data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      const priceCanvas = page.getByTestId("price-history-canvas");
      const canvasCount = await priceCanvas.count();
      expect(
        canvasCount,
        "Price history canvas should be present with seeded fixture data",
      ).toBeGreaterThan(0);

      await expectCanvasChartRendered(priceCanvas, "Price history");
    });

    test("should render chart axes and grid pixels with seeded price data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      // Fixture data guarantees chart renders — assert structural elements
      await expectCanvasChartRendered(
        page.getByTestId("price-history-canvas"),
        "Price history",
      );
    });

    test("should render chart data pixels with seeded price data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);
      await waitForMarketDataSettled(page);

      await expectCanvasChartRendered(
        page.getByTestId("price-history-canvas"),
        "Price history",
      );
    });
  });

  // ── Tab Interaction After Market Data ─────────────────────────────────────

  test.describe("Tab Interaction", () => {
    test("should switch back to Your Data tab after viewing Market Data", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await switchToMarketTab(page);

      // Switch back to Your Data
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await yourDataTab.click();
      await expect(yourDataTab).toHaveClass(/tab-active/, { timeout: 5_000 });

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
      await expect(yourDataTab).toHaveClass(/tab-active/, { timeout: 5_000 });

      route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");

      // Switch to Market Data again
      await switchToMarketTab(page);
      route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });
  });
});
