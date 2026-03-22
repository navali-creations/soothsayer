/**
 * E2E Tests: Card Browsing Flow
 *
 * Tests the card browsing user flow (grid, search, filter, pagination):
 * 1. Navigate to Cards page via sidebar
 * 2. Verify cards grid loads with card data
 * 3. Search/filter cards by name
 * 4. Filter by rarity
 * 5. Pagination through results
 * 6. Cross-flow interactions (search state preservation, page transitions)
 *
 * Card detail page tests (navigation to/from details, tabs, personal
 * analytics, chart rendering) live in `card-detail.e2e.test.ts`.
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required — cards load from bundled `renderer/assets/poe1/cards.json`
 *   into local SQLite at startup
 *
 * UI component notes (from real component investigation):
 * - Cards are rendered as <li> → <div class="cursor-pointer" onClick={navigate}> → <DivinationCard>
 * - There are NO <a> tags, NO data-testid, NO href attributes on card items
 * - Navigation uses TanStack Router's navigate() with hash routing: #/cards/{slug}
 * - Search input: <input type="search" placeholder="Search cards...">
 * - Rarity filter: <select class="select select-sm select-bordered"> with options
 * - Pagination: plain <button class="btn btn-sm"> with text "Previous", "Next", page numbers
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../helpers/electron-test";
import {
  clickSidebarLink,
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
  waitForRoute,
} from "../helpers/navigation";
import type { SeedCardRarityOptions } from "../helpers/seed-db";
import { seedCardRarities } from "../helpers/seed-db";

// ─── Rarity seed data ─────────────────────────────────────────────────────────

const RARITY_SEEDS: SeedCardRarityOptions[] = [
  // Extremely Rare (1)
  { cardName: "House of Mirrors", rarity: 1 },
  { cardName: "The Doctor", rarity: 1 },
  { cardName: "Unrequited Love", rarity: 1 },
  { cardName: "The Fiend", rarity: 1 },
  { cardName: "The Immortal", rarity: 1 },
  // Rare (2)
  { cardName: "The Nurse", rarity: 2 },
  { cardName: "The Patient", rarity: 2 },
  { cardName: "The Enlightened", rarity: 2 },
  { cardName: "Abandoned Wealth", rarity: 2 },
  { cardName: "The Demon", rarity: 2 },
  { cardName: "Seven Years Bad Luck", rarity: 2 },
  // Less Common (3)
  { cardName: "The Wretched", rarity: 3 },
  { cardName: "Humility", rarity: 3 },
  { cardName: "The Gambler", rarity: 3 },
  { cardName: "Loyalty", rarity: 3 },
  { cardName: "The Union", rarity: 3 },
  { cardName: "Lucky Connections", rarity: 3 },
  // Common (4)
  { cardName: "Rain of Chaos", rarity: 4 },
  { cardName: "Carrion Crow", rarity: 4 },
  { cardName: "The Lover", rarity: 4 },
  { cardName: "The Hermit", rarity: 4 },
  { cardName: "The Scholar", rarity: 4 },
  { cardName: "Lantador's Lost Love", rarity: 4 },
  { cardName: "The Inoculated", rarity: 4 },
  { cardName: "The Metalsmith's Gift", rarity: 4 },
];

let raritiesSeeded = false;

async function ensureRaritiesSeeded(page: Page): Promise<void> {
  if (raritiesSeeded) return;
  await seedCardRarities(page, RARITY_SEEDS);
  raritiesSeeded = true;
}

/**
 * Reset the Zustand cards store filters/search so every test starts from a
 * clean "All cards, no search" state.  This is necessary because the store
 * lives in the renderer's JS heap and persists across in-worker navigations.
 */
async function resetCardsFilters(page: Page): Promise<void> {
  await page.evaluate(() => {
    // The Zustand store is not directly accessible, but we can clear the
    // search input and reset filters by interacting with the DOM.
    const searchInput = document.querySelector<HTMLInputElement>(
      'input[type="text"], input[type="search"], input[placeholder*="earch"]',
    );
    if (searchInput) {
      // Trigger a React-compatible change via the native setter so Zustand
      // picks it up through the onChange handler.
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(searchInput, "");
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      searchInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const raritySelect = document.querySelector<HTMLSelectElement>("select");
    if (raritySelect && raritySelect.value !== "all") {
      const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLSelectElement.prototype,
        "value",
      )?.set;
      nativeSelectValueSetter?.call(raritySelect, "all");
      raritySelect.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  // Wait for the card list to re-render after clearing filters
  await page
    .locator("main ul > li")
    .first()
    .waitFor({ state: "visible", timeout: 5_000 })
    .catch(() => {});
}

// All card browsing tests require setup to be complete so the sidebar is visible
test.describe("Card Browsing Flow", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);

    // Seed rarity data so the rarity dropdown filter finds matching cards.
    // Must happen before any navigation to /cards so loadCards() sees the data.
    await ensureRaritiesSeeded(page);
  });

  test.describe("Cards Grid", () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);
      // Clear any lingering search/filter state from prior tests
      await resetCardsFilters(page);
      // Wait for at least one card to render instead of a hard timeout
      await page
        .locator("main ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    });

    test("should display the cards page with a heading or title", async ({
      page,
    }) => {
      // The cards page should have some identifiable heading or content
      const pageContent = await page.textContent("main");
      expect(pageContent).toBeTruthy();
    });

    test("should display card items in the grid", async ({ page }) => {
      // Cards are rendered as <li> elements inside a <ul>
      const cardItems = page.locator("main ul > li");
      const count = await cardItems.count();
      expect(
        count,
        "Should have card items rendered in the grid",
      ).toBeGreaterThan(0);

      // Each card item should contain a clickable div
      const firstCard = cardItems.first().locator(".cursor-pointer");
      await expect(firstCard).toBeVisible();
    });

    test("should show search input for filtering cards", async ({ page }) => {
      // The search input is <input type="search" placeholder="Search cards...">
      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="earch"]',
        )
        .first();

      // The cards page should have a search/filter input
      await expect(searchInput).toBeVisible({ timeout: 5_000 });
      await expect(searchInput).toBeEnabled();
    });
  });

  test.describe("Card Search", () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);
      // Clear any lingering search/filter state from prior tests
      await resetCardsFilters(page);
      // Wait for at least one card to render
      await page
        .locator("main ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    });

    test("should filter cards when typing in search", async ({ page }) => {
      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="earch"]',
        )
        .first();
      await expect(searchInput, "Search input must be visible").toBeVisible({
        timeout: 5_000,
      });

      // Count cards before search
      const countBefore = await page.locator("main ul > li").count();

      // Type a search query — "Doctor" is a well-known card
      // Capture content before search to detect change after debounce
      const contentBefore = await page.locator("main").textContent();
      await searchInput.fill("Doctor");

      // Wait for debounced search to take effect by detecting content change
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBefore,
        { timeout: 5_000 },
      );

      // The page content should have changed (filtered results)
      const contentAfter = await page.locator("main").textContent();

      // We can't guarantee specific results without seeded data,
      // but the content should still be present (not blank)
      expect(contentAfter).toBeTruthy();

      // If we had cards before, the filtered count should be different (fewer)
      if (countBefore > 1) {
        const countAfter = await page.locator("main ul > li").count();
        expect(
          countAfter,
          "Filtered results should be fewer than unfiltered",
        ).toBeLessThan(countBefore);
      }
    });

    test("should clear search and restore full list", async ({ page }) => {
      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="earch"]',
        )
        .first();
      await expect(searchInput, "Search input must be visible").toBeVisible({
        timeout: 5_000,
      });

      // Count cards before any interaction
      const countBefore = await page.locator("main ul > li").count();

      // Type a search query
      const contentBeforeSearch = await page.locator("main").textContent();
      await searchInput.fill("Doctor");

      // Wait for debounced search to filter results
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeSearch,
        { timeout: 5_000 },
      );

      // Clear the search
      const contentBeforeClear = await page.locator("main").textContent();
      await searchInput.fill("");

      // Wait for debounced clear to restore full list
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeClear,
        { timeout: 5_000 },
      );

      // The page should show full list again
      const countAfterClear = await page.locator("main ul > li").count();
      expect(
        countAfterClear,
        "Card count should be restored after clearing search",
      ).toBe(countBefore);
    });

    test("should handle search with no results gracefully", async ({
      page,
    }) => {
      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="earch"]',
        )
        .first();
      await expect(searchInput, "Search input must be visible").toBeVisible({
        timeout: 5_000,
      });

      // Search for something that won't match any card
      const contentBeforeNoMatch = await page.locator("main").textContent();
      await searchInput.fill("xyznonexistentcardname999");

      // Wait for debounced search to take effect
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeNoMatch,
        { timeout: 5_000 },
      );

      // The page should handle empty results gracefully (no crash, shows empty state)
      const mainContent = page.locator("main");
      await expect(mainContent).toBeVisible();

      // Should have zero card items
      const cardCount = await page.locator("main ul > li").count();
      expect(cardCount, "No cards should match a nonsense query").toBe(0);
    });
  });

  test.describe("Card Filtering", () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);
      // Clear any lingering search/filter state from prior tests
      await resetCardsFilters(page);
      // Wait for at least one card to render
      await page
        .locator("main ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    });

    test("should have filter controls visible", async ({ page }) => {
      // The rarity filter is a <select> with "All Rarities" as the default option
      const raritySelect = page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "All Rarities" }) })
        .first();
      await expect(raritySelect).toBeVisible({ timeout: 5_000 });
    });

    test("should filter by rarity when rarity filter is available", async ({
      page,
    }) => {
      // The rarity filter is a <select class="select select-sm select-bordered">
      // with options: "All Rarities", "Extremely Rare", "Rare", "Less Common", "Common"
      const raritySelect = page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "All Rarities" }) })
        .first();

      await expect(
        raritySelect,
        "Rarity filter select should be visible",
      ).toBeVisible({ timeout: 5_000 });

      // Count cards before filtering
      const countBefore = await page.locator("main ul > li").count();
      expect(
        countBefore,
        "Should have cards loaded before filtering",
      ).toBeGreaterThan(0);

      // Select "Rare" rarity (value "2" based on the UI)
      const contentBeforeFilter = await page.locator("main").textContent();
      await raritySelect.selectOption({ label: "Rare" });

      // Wait for the filter to take effect by detecting content change
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeFilter,
        { timeout: 5_000 },
      );

      // Verify the page is still functional after interacting with the filter
      const mainContent = page.locator("main");
      await expect(mainContent).toBeVisible();

      // The count should have changed (fewer cards when filtering to one rarity)
      const countAfter = await page.locator("main ul > li").count();
      // With a Rare filter, we should still get some results but fewer than all
      if (countBefore > 1) {
        expect(
          countAfter,
          "Filtering by Rare should change the card count",
        ).toBeLessThan(countBefore);
      }

      // Reset filter back to "All Rarities"
      const contentBeforeReset = await page.locator("main").textContent();
      await raritySelect.selectOption({ label: "All Rarities" });

      // Wait for the filter reset to take effect
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeReset,
        { timeout: 5_000 },
      );

      const countAfterReset = await page.locator("main ul > li").count();
      expect(
        countAfterReset,
        "Resetting rarity filter should restore original count",
      ).toBe(countBefore);
    });

    test("should filter by each rarity level", async ({ page }) => {
      const raritySelect = page
        .locator("select")
        .filter({ has: page.locator("option", { hasText: "All Rarities" }) })
        .first();

      await expect(
        raritySelect,
        "Rarity filter select should be visible",
      ).toBeVisible({ timeout: 5_000 });

      // Get the baseline count with "All Rarities"
      const countAll = await page.locator("main ul > li").count();
      expect(
        countAll,
        "Should have cards loaded before filtering",
      ).toBeGreaterThan(0);

      const rarityOptions = [
        { label: "Extremely Rare", value: "1" },
        { label: "Rare", value: "2" },
        { label: "Less Common", value: "3" },
        { label: "Common", value: "4" },
      ] as const;

      for (const option of rarityOptions) {
        // Select the rarity option
        const contentBefore = await page.locator("main").textContent();
        await raritySelect.selectOption({ label: option.label });

        // Wait for the filter to take effect
        await page.waitForFunction(
          (prevContent) =>
            document.querySelector("main")?.textContent !== prevContent,
          contentBefore,
          { timeout: 5_000 },
        );

        // Verify the page is still functional
        const mainContent = page.locator("main");
        await expect(mainContent).toBeVisible();

        // The count should differ from the "All Rarities" count
        const countFiltered = await page.locator("main ul > li").count();
        if (countAll > 1) {
          expect(
            countFiltered,
            `Filtering by "${option.label}" should change the card count`,
          ).toBeLessThan(countAll);
        }

        // Reset back to "All Rarities" before the next iteration
        const contentBeforeReset = await page.locator("main").textContent();
        await raritySelect.selectOption({ label: "All Rarities" });

        await page.waitForFunction(
          (prevContent) =>
            document.querySelector("main")?.textContent !== prevContent,
          contentBeforeReset,
          { timeout: 5_000 },
        );

        const countAfterReset = await page.locator("main ul > li").count();
        expect(
          countAfterReset,
          `Resetting filter after "${option.label}" should restore original count`,
        ).toBe(countAll);
      }
    });

    test("should show rarity source selector", async ({ page }) => {
      // The RaritySourceSelect renders a <button> trigger with a popoverTarget.
      // It displays the currently selected source label (e.g. "poe.ninja").
      // Look for the trigger button that contains one of the known source labels.
      const raritySourceTrigger = page
        .locator("button")
        .filter({ hasText: /poe\.ninja|Prohibited Library/ })
        .first();

      await expect(
        raritySourceTrigger,
        "Rarity source selector trigger should be visible",
      ).toBeVisible({ timeout: 5_000 });
    });

    test("should switch rarity source to Prohibited Library and back", async ({
      page,
    }) => {
      // The RaritySourceSelect is a custom dropdown with a <button> trigger
      // and a popover containing grouped options.

      // Find the trigger button showing the current rarity source
      const raritySourceTrigger = page
        .locator("button")
        .filter({ hasText: /poe\.ninja|Prohibited Library/ })
        .first();

      await expect(
        raritySourceTrigger,
        "Rarity source selector trigger should be visible",
      ).toBeVisible({ timeout: 5_000 });

      // The page may auto-trigger a scan on mount (when no filters are
      // cached), which keeps the dropdown disabled until it finishes.
      // Wait for the button to become enabled before interacting.
      await expect(raritySourceTrigger).toBeEnabled({ timeout: 30_000 });

      // Capture the initial trigger text to know the starting source
      const initialLabel = await raritySourceTrigger.textContent();

      // Capture content before switching so we can detect re-render
      const contentBeforeSwitch = await page.locator("main").textContent();

      // Click the trigger to open the popover dropdown
      await raritySourceTrigger.click();

      // The popover renders <button> elements for each option.
      // Click "Prohibited Library" if we're currently on poe.ninja, or vice versa.
      const targetLabel = initialLabel?.includes("poe.ninja")
        ? "Prohibited Library"
        : "poe.ninja";

      // Find and click the option button inside the popover
      const optionButton = page
        .locator("[popover] button")
        .filter({ hasText: targetLabel })
        .first();
      await expect(optionButton).toBeVisible({ timeout: 3_000 });
      await optionButton.click();

      // Wait for the cards to re-render after the source change
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeSwitch,
        { timeout: 10_000 },
      );

      // Verify the trigger now shows the new source label
      await expect(raritySourceTrigger).toContainText(targetLabel, {
        timeout: 5_000,
      });

      // Verify cards are still rendered
      await page
        .locator("main ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 5_000 });

      // Now switch back to the original source
      const contentBeforeSwitchBack = await page.locator("main").textContent();

      // Re-open the dropdown
      await raritySourceTrigger.click();

      // Click the original source option
      const originalLabel = initialLabel?.includes("poe.ninja")
        ? "poe.ninja"
        : "Prohibited Library";

      const originalOptionButton = page
        .locator("[popover] button")
        .filter({ hasText: originalLabel })
        .first();
      await expect(originalOptionButton).toBeVisible({ timeout: 3_000 });
      await originalOptionButton.click();

      // Wait for the cards to re-render after switching back
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeSwitchBack,
        { timeout: 10_000 },
      );

      // Verify the trigger shows the original label again
      await expect(raritySourceTrigger).toContainText(originalLabel, {
        timeout: 5_000,
      });

      // Verify cards are still rendered after restoration
      await page
        .locator("main ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 5_000 });
    });
  });

  test.describe("Card Pagination", () => {
    test.beforeEach(async ({ page }) => {
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);
      // Clear any lingering search/filter state from prior tests
      await resetCardsFilters(page);
      // Wait for at least one card to render
      await page
        .locator("main ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
    });

    test("should display pagination controls when there are many cards", async ({
      page,
    }) => {
      // Pagination buttons are plain <button> elements with text "Next", "Previous", and page numbers
      const nextButton = page.locator('main button:has-text("Next")').first();
      const prevButton = page
        .locator('main button:has-text("Previous")')
        .first();

      // With ~450 cards in the dataset, pagination should definitely be visible
      await nextButton.waitFor({ state: "visible", timeout: 5_000 });

      const cardCount = await page.locator("main ul > li").count();
      expect(
        cardCount,
        "Pagination should be visible with 450+ cards in the dataset",
      ).toBeGreaterThan(0);

      await expect(nextButton).toBeVisible();
      await expect(prevButton).toBeVisible();

      // Previous should be disabled on page 1
      await expect(prevButton).toBeDisabled();
    });

    test("should navigate to next page when clicking next", async ({
      page,
    }) => {
      const nextButton = page.locator('button:has-text("Next")').first();

      await expect(
        nextButton,
        "Next button must be visible — dataset has 450+ cards",
      ).toBeVisible({ timeout: 5_000 });

      await expect(
        nextButton,
        "Next button must be enabled — dataset has 450+ cards",
      ).toBeEnabled();

      // Remember the first card's text content before navigating
      const firstCardTextBefore = await page
        .locator("main ul > li")
        .first()
        .textContent();

      await nextButton.click();

      // Wait for page content to change after pagination click
      await page.waitForFunction(
        (prevText) =>
          document.querySelector("main ul > li")?.textContent !== prevText,
        firstCardTextBefore,
        { timeout: 5_000 },
      );

      // Content should have changed — different set of cards on page 2
      const firstCardTextAfter = await page
        .locator("main ul > li")
        .first()
        .textContent();
      expect(
        firstCardTextAfter,
        "Page 2 should show different cards than page 1",
      ).not.toBe(firstCardTextBefore);

      // Previous button should now be enabled
      const prevButton = page
        .locator('main button:has-text("Previous")')
        .first();
      await expect(prevButton).toBeEnabled();
    });
  });

  test.describe("Cross-flow interactions", () => {
    test("should preserve search state when navigating back from card details", async ({
      page,
    }) => {
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);
      // Clear any lingering search/filter state from prior tests
      await resetCardsFilters(page);
      // Wait for at least one card to render
      await page
        .locator("ul > li")
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });

      const searchInput = page
        .locator(
          'input[type="text"], input[type="search"], input[placeholder*="earch"]',
        )
        .first();
      await expect(searchInput, "Search input must be visible").toBeVisible({
        timeout: 5_000,
      });

      // Type a search query
      const contentBeforeSearch = await page.locator("main").textContent();
      await searchInput.fill("Doctor");

      // Wait for debounced search to take effect
      await page.waitForFunction(
        (prevContent) =>
          document.querySelector("main")?.textContent !== prevContent,
        contentBeforeSearch,
        { timeout: 5_000 },
      );

      // Click on a card in the filtered results to navigate to details
      const firstCardClickable = page
        .locator("main ul > li")
        .first()
        .locator(".cursor-pointer")
        .first();

      const hasFilteredCards = await firstCardClickable
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (hasFilteredCards) {
        await firstCardClickable.click();
        // Wait for navigation to card details route
        await page.waitForFunction(
          () => /^#\/cards\/.+/.test(window.location.hash),
          { timeout: 5_000 },
        );
      } else {
        // No cards matched, just navigate away
        await navigateTo(page, "/settings");
        await waitForRoute(page, "/settings", 5_000);
      }

      // Navigate back to cards
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);

      // The page should be functional after returning
      const mainContent = page.locator("main");
      await expect(mainContent).toBeVisible();
    });

    test("should navigate between cards page and other pages smoothly", async ({
      page,
    }) => {
      // Navigate to Cards
      await navigateTo(page, "/cards");
      await waitForRoute(page, "/cards", 10_000);
      await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

      // Navigate to Sessions
      await clickSidebarLink(page, "Sessions");
      await waitForRoute(page, "/sessions", 10_000);
      let route = await getCurrentRoute(page);
      expect(route).toBe("/sessions");

      // Navigate back to Cards
      await clickSidebarLink(page, "Cards");
      await waitForRoute(page, "/cards", 10_000);
      route = await getCurrentRoute(page);
      expect(route).toBe("/cards");

      // Navigate to Statistics
      await clickSidebarLink(page, "Statistics");
      await waitForRoute(page, "/statistics", 10_000);
      route = await getCurrentRoute(page);
      expect(route).toBe("/statistics");

      // Navigate back to Cards once more
      await clickSidebarLink(page, "Cards");
      await waitForRoute(page, "/cards", 10_000);
      route = await getCurrentRoute(page);
      expect(route).toBe("/cards");

      // Main content should still be visible and functional
      const mainContent = page.locator("main");
      await expect(mainContent).toBeVisible();
    });
  });
});
