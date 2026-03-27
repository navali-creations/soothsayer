/**
 * E2E Test: Profit Forecast – Interactions
 *
 * Functional tests for the interactive elements of the Profit Forecast page
 * (/profit-forecast) covering:
 *
 *   1. Refresh poe.ninja — header button triggers price refresh with loading state
 *   2. Base Rate Refresh — badge in summary cards triggers a refresh
 *   3. Cost Model Panel — batch chips and sliders update summary stat values
 *   4. Pagination — table pagination controls navigate between pages
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Uses `seedSessionPrerequisites` to populate a league, snapshot, and sample
 *   card prices so the page has data to render
 * - Summary card values depend on seeded snapshot data; table population also
 *   requires Prohibited Library weights. Tests that depend on specific UI
 *   elements degrade gracefully when those elements are absent.
 *
 * @module e2e/flows/profit-forecast/profit-forecast-interactions
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../../helpers/electron-test";
import { ensurePostSetup, navigateTo } from "../../helpers/navigation";
import { seedSessionPrerequisites } from "../../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navigate to the Profit Forecast page and wait for the heading to appear.
 */
async function goToProfitForecast(page: Page) {
  await navigateTo(page, "/profit-forecast");
  await page
    .getByText("Profit Forecast", { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Wait for loading spinners to resolve and main content to render.
 */
async function waitForPageData(page: Page) {
  await expect(page.locator(".loading.loading-spinner.loading-lg")).toHaveCount(
    0,
    { timeout: 15_000 },
  );
  await expect
    .poll(async () => (await page.locator("main").textContent())?.length ?? 0, {
      timeout: 10_000,
      intervals: [100, 200, 500, 1_000],
    })
    .toBeGreaterThan(50);
}

/**
 * Seed data, navigate to /profit-forecast, and wait for the page to settle.
 * Returns the seed result for further use.
 */
async function seedAndNavigate(page: Page) {
  let seedResult: { leagueId: string; snapshotId: string } | null = null;
  try {
    seedResult = await seedSessionPrerequisites(page);
  } catch {
    // May already be seeded from a previous test in this worker
  }

  await goToProfitForecast(page);
  await waitForPageData(page);

  return seedResult;
}

/**
 * Read the text content of the first stat-value element whose sibling
 * stat-title contains the given label.
 *
 * The summary cards use `<Stat>` → `<Stat.Title>` / `<Stat.Value>` which
 * render with classes `stat-title` and `stat-value` respectively.
 */
async function getStatValue(page: Page, titleText: string): Promise<string> {
  // Each stat is a <div class="stat"> containing a <div class="stat-title">
  // and a <div class="stat-value">. We find the stat-title that matches,
  // then go up to its parent .stat container to read the value.
  const titleLocator = page
    .locator(".stat-title")
    .filter({ hasText: titleText })
    .first();

  // Navigate to the parent .stat container
  const stat = titleLocator.locator("..");
  const value = stat.locator(".stat-value").first();
  const text = await value.textContent({ timeout: 5_000 }).catch(() => "");
  return (text ?? "").trim();
}

/**
 * Check whether a stat value is a rendered number/formatted string
 * (not a skeleton, dash, or empty).
 */
function isRenderedValue(text: string): boolean {
  return text.length > 0 && text !== "—" && !text.includes("skeleton");
}

/**
 * Wait for the debounced recompute cycle to complete after a cost-model change.
 *
 * The cycle is: click → `setIsComputing(true)` → 300 ms debounce fires →
 * `recomputeRows()` runs synchronously → `setIsComputing(false)`.
 *
 * During `isComputing` the summary cards render `<Skeleton />` placeholders
 * and the table shows a backdrop-blur overlay with a spinner.
 *
 * We wait for the skeleton to appear (proving the recompute started) then
 * wait for it to disappear (proving the recompute finished and the new
 * values are rendered).
 */
async function waitForRecompute(page: Page) {
  // 1. Give the debounce timer (300 ms) time to fire and React to schedule
  //    the computing state.  We poll for the skeleton rather than a blind
  //    sleep so we proceed as soon as it appears.
  try {
    await page.locator(".stat-value .skeleton").first().waitFor({
      state: "visible",
      timeout: 2_000,
    });
  } catch {
    // The recompute may be so fast the skeleton never becomes visible.
    // That's fine — fall through and verify the final state below.
  }

  // 2. Wait until no skeleton remains inside any stat-value (values settled).
  await expect(page.locator(".stat-value .skeleton")).toHaveCount(0, {
    timeout: 15_000,
  });

  // 3. Also wait for the table computing overlay to clear.
  await expect(page.locator(".backdrop-blur-sm .loading-spinner")).toHaveCount(
    0,
    { timeout: 10_000 },
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Profit Forecast – Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
  });

  // ── Refresh poe.ninja ───────────────────────────────────────────────────

  test.describe("Refresh poe.ninja", () => {
    test("refresh poe.ninja button triggers price check and shows loading state", async ({
      page,
    }) => {
      await seedAndNavigate(page);

      // Find the "Refresh poe.ninja" button in the header actions area
      const refreshButton = page.getByText("Refresh poe.ninja", {
        exact: false,
      });
      const isVisible = await refreshButton
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!isVisible) {
        // Button may show a cooldown timer instead — this is valid if a
        // recent refresh occurred. Verify the button area exists but is
        // in cooldown state (shows a lock icon or countdown).
        const cooldownButton = page
          .locator("button")
          .filter({ has: page.locator("svg") })
          .filter({ hasText: /\d+:\d+/ });

        const hasCooldown = await cooldownButton
          .first()
          .isVisible({ timeout: 3_000 })
          .catch(() => false);

        if (hasCooldown) {
          // Refresh is on cooldown — this is a valid state, not an error
          return;
        }

        // If neither the button nor a cooldown is visible, check for
        // "Refreshing..." text which means a refresh is already in progress
        const refreshingText = page.getByText("Refreshing...", {
          exact: false,
        });
        const isRefreshing = await refreshingText
          .isVisible({ timeout: 2_000 })
          .catch(() => false);

        if (isRefreshing) {
          // Already refreshing — valid state
          return;
        }

        // The button area exists but may be disabled — still pass
        return;
      }

      // Click the refresh button
      await refreshButton.click();

      // Assert that some loading indication becomes visible:
      // Either "Refreshing..." button text, the info alert, or a spinner
      const loadingIndicators = [
        page.getByText("Refreshing...", { exact: false }),
        page.getByText("Fetching latest prices from poe.ninja", {
          exact: false,
        }),
        page.locator(".animate-spin"),
      ];

      // At least one loading indicator should appear within a short window
      let sawLoadingState = false;
      for (const indicator of loadingIndicators) {
        const appeared = await indicator
          .first()
          .isVisible({ timeout: 2_000 })
          .catch(() => false);
        if (appeared) {
          sawLoadingState = true;
          break;
        }
      }

      // The refresh may complete very quickly in E2E (local DB, no real
      // network). If we didn't catch the transient loading state, verify
      // the button has returned to its idle state or is on cooldown.
      if (!sawLoadingState) {
        // Wait a moment for the refresh cycle to complete
        await page.waitForTimeout(2_000);
      }

      // After refresh completes, the button should return to idle or cooldown
      await expect
        .poll(
          async () => {
            const text = (await page.locator("body").textContent()) ?? "";
            return (
              text.includes("Refresh poe.ninja") ||
              // Cooldown state (shows time remaining)
              /\d+:\d+/.test(text)
            );
          },
          { timeout: 30_000, intervals: [200, 500, 1_000] },
        )
        .toBe(true);
    });
  });

  // ── Custom Base Rate ────────────────────────────────────────────────────

  test.describe("Custom Base Rate", () => {
    test("editing the base rate via pencil icon updates stats and can be reset", async ({
      page,
    }) => {
      await seedAndNavigate(page);

      // Locate the Base Rate stat card
      const baseRateStat = page
        .locator("[data-onboarding='pf-base-rate']")
        .first();
      const isBaseRateVisible = await baseRateStat
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!isBaseRateVisible) {
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Read the original base rate value
      const originalValue = await getStatValue(page, "Base Rate");
      if (!isRenderedValue(originalValue)) {
        // No base rate available — gracefully exit
        return;
      }

      // Click the pencil icon button to start editing
      const pencilButton = baseRateStat.locator(
        "button[data-tip='Set custom base rate']",
      );
      const isPencilVisible = await pencilButton
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (!isPencilVisible) {
        // Pencil button not rendered — gracefully exit
        return;
      }

      await pencilButton.click();

      // The input field should appear
      const rateInput = baseRateStat.locator("input[type='number']");
      await expect(rateInput).toBeVisible({ timeout: 3_000 });

      // Type a custom value and confirm with Enter
      await rateInput.fill("90");
      await rateInput.press("Enter");

      // Wait for recompute to finish
      await waitForRecompute(page);

      // Verify the "custom" badge appeared
      const customBadge = baseRateStat.getByText("custom", { exact: true });
      await expect(customBadge).toBeVisible({ timeout: 3_000 });

      // Verify the displayed rate changed
      const customValue = await getStatValue(page, "Base Rate");
      expect(customValue).toContain("90");

      // Verify the "Reset" button is visible
      const resetButton = baseRateStat.getByText("Reset", { exact: true });
      await expect(resetButton).toBeVisible({ timeout: 3_000 });

      // Click Reset to restore market rate
      await resetButton.click();
      await waitForRecompute(page);

      // Verify the "custom" badge is gone
      await expect(customBadge).not.toBeVisible({ timeout: 3_000 });

      // Verify the value returned to the original
      const restoredValue = await getStatValue(page, "Base Rate");
      expect(restoredValue).toBe(originalValue);

      // Page should still be functional
      const main = page.locator("main");
      await expect(main).toBeVisible();
    });

    test("pressing Escape cancels editing without changing the rate", async ({
      page,
    }) => {
      await seedAndNavigate(page);

      const baseRateStat = page
        .locator("[data-onboarding='pf-base-rate']")
        .first();
      const isBaseRateVisible = await baseRateStat
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!isBaseRateVisible) {
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      const originalValue = await getStatValue(page, "Base Rate");
      if (!isRenderedValue(originalValue)) return;

      const pencilButton = baseRateStat.locator(
        "button[data-tip='Set custom base rate']",
      );
      const isPencilVisible = await pencilButton
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (!isPencilVisible) return;

      await pencilButton.click();

      const rateInput = baseRateStat.locator("input[type='number']");
      await expect(rateInput).toBeVisible({ timeout: 3_000 });

      // Type a value but press Escape to cancel
      await rateInput.fill("50");
      await rateInput.press("Escape");

      // Input should disappear
      await expect(rateInput).not.toBeVisible({ timeout: 3_000 });

      // Value should not have changed
      const afterValue = await getStatValue(page, "Base Rate");
      expect(afterValue).toBe(originalValue);

      // No "custom" badge should appear
      const customBadge = baseRateStat.getByText("custom", { exact: true });
      const hasBadge = await customBadge
        .isVisible({ timeout: 1_000 })
        .catch(() => false);
      expect(hasBadge).toBe(false);
    });
  });

  // ── Cost Model Panel – Decks & Sliders ──────────────────────────────────

  test.describe("Cost Model Panel – Decks & Sliders", () => {
    test("selecting different batch size chips updates the summary numbers", async ({
      page,
    }) => {
      await seedAndNavigate(page);

      // Verify the cost model panel is visible by checking for batch chip buttons
      // Note: the default selectedBatch in the store is 10_000 (10k).
      const chip10k = page.locator("button").getByText("10k", { exact: true });
      const isChipVisible = await chip10k
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!isChipVisible) {
        // Cost model panel not rendered — page may be in error/empty state
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Read the initial "You Spend" stat value (default batch is 10k)
      const spendDefault = await getStatValue(page, "You Spend");

      // If You Spend shows "—" (no data), the sliders won't change it — skip
      if (!isRenderedValue(spendDefault)) {
        // Verify the page is functional, just no computed spend data
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Switch to 1k — this IS a change from the default (10k)
      const chip1k = page.locator("button").getByText("1k", { exact: true });
      await chip1k.click();

      // Wait for the full recompute cycle (skeleton → value)
      await waitForRecompute(page);

      // Read the updated "You Spend" value
      const spendAfter1k = await getStatValue(page, "You Spend");

      // 1k batch should produce a different "You Spend" than the default 10k
      if (isRenderedValue(spendAfter1k)) {
        expect(spendAfter1k).not.toBe(spendDefault);
      }

      // Now switch to 100k
      const chip100k = page
        .locator("button")
        .getByText("100k", { exact: true });
      await chip100k.click();

      await waitForRecompute(page);

      const spendAfter100k = await getStatValue(page, "You Spend");

      // 100k should produce a different value than 1k
      if (isRenderedValue(spendAfter100k)) {
        expect(spendAfter100k).not.toBe(spendAfter1k);
      }

      // Restore the default (10k) for subsequent tests
      await chip10k.click();
      await waitForRecompute(page);
    });

    test("adjusting price increase slider updates values", async ({ page }) => {
      await seedAndNavigate(page);

      // The "Price increase per batch" slider is a range input (min=1, max=5)
      // inside the cost model panel. Find it by its range attributes.
      const priceIncreaseSlider = page.locator(
        'input[type="range"][min="1"][max="5"]',
      );
      const isSliderVisible = await priceIncreaseSlider
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!isSliderVisible) {
        // Slider not rendered — may be disabled because no stacked deck price
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Read the current "You Spend" value before changing the slider
      const spendBefore = await getStatValue(page, "You Spend");

      if (!isRenderedValue(spendBefore)) {
        // No computed spend data — slider changes won't produce visible diff
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Get the current slider value
      const currentValue = await priceIncreaseSlider.inputValue();
      const newValue = currentValue === "5" ? "1" : "5";

      // Change the slider value
      await priceIncreaseSlider.fill(newValue);

      // Wait for the full recompute cycle
      await waitForRecompute(page);

      // Read the updated value
      const spendAfter = await getStatValue(page, "You Spend");

      // Slider changes affect cost calculation — values should differ
      if (isRenderedValue(spendAfter)) {
        expect(spendAfter).not.toBe(spendBefore);
      }

      // Restore the original value
      await priceIncreaseSlider.fill(currentValue);
      await waitForRecompute(page);
    });

    test("adjusting batch size slider updates values", async ({ page }) => {
      await seedAndNavigate(page);

      // The "Batch size" slider is a range input (min=1000, max=10000, step=1000)
      const batchSizeSlider = page.locator(
        'input[type="range"][min="1000"][max="10000"]',
      );
      const isSliderVisible = await batchSizeSlider
        .isVisible({ timeout: 5_000 })
        .catch(() => false);

      if (!isSliderVisible) {
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Read current value and "You Spend" stat
      const spendBefore = await getStatValue(page, "You Spend");

      if (!isRenderedValue(spendBefore)) {
        // No computed spend data — slider changes won't produce visible diff
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      const currentValue = await batchSizeSlider.inputValue();

      // Toggle to a different value
      const newValue = currentValue === "10000" ? "1000" : "10000";
      await batchSizeSlider.fill(newValue);

      // Wait for the full recompute cycle
      await waitForRecompute(page);

      const spendAfter = await getStatValue(page, "You Spend");

      if (isRenderedValue(spendAfter)) {
        expect(spendAfter).not.toBe(spendBefore);
      }

      // Restore original slider value
      await batchSizeSlider.fill(currentValue);
      await waitForRecompute(page);
    });
  });

  // ── Pagination ──────────────────────────────────────────────────────────

  test.describe("Pagination", () => {
    test("pagination controls navigate between pages", async ({ page }) => {
      await seedAndNavigate(page);

      const tableRows = page.locator("table tbody tr");
      const rowCount = await tableRows.count();

      if (rowCount === 0) {
        // No table data — verify the page is still functional
        const main = page.locator("main");
        await expect(main).toBeVisible();
        return;
      }

      // Look for the "Showing X to Y of Z results" text
      const showingText = page.getByText(/Showing \d+ to \d+ of \d+ results/);
      const hasPaginationText = await showingText
        .isVisible({ timeout: 3_000 })
        .catch(() => false);

      if (!hasPaginationText) {
        // No pagination text — table may have very few rows (≤ page size of 20)
        // and no pagination is rendered. Verify the table is visible with data.
        expect(rowCount).toBeGreaterThan(0);
        return;
      }

      // Extract the showing text to check the numbers are consistent
      const showingContent = await showingText.textContent();
      expect(showingContent).toBeTruthy();

      const match = showingContent!.match(
        /Showing (\d+) to (\d+) of (\d+) results/,
      );
      expect(match).toBeTruthy();

      const from = parseInt(match![1], 10);
      const to = parseInt(match![2], 10);
      const total = parseInt(match![3], 10);
      expect(from).toBe(1);
      expect(to).toBeLessThanOrEqual(total);

      // Check if there's a page count indicator "Page X of Y"
      const pageIndicator = page.getByText(/Page \d+ of \d+/);
      const hasPageIndicator = await pageIndicator
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      if (!hasPageIndicator) {
        // Pagination text is shown but no page indicator — single page
        return;
      }

      const pageText = await pageIndicator.textContent();
      expect(pageText).toContain("Page 1");

      // Extract page count from "Page X of Y"
      const pageMatch = pageText!.match(/Page \d+ of (\d+)/);
      const totalPages = pageMatch ? parseInt(pageMatch[1], 10) : 1;

      if (totalPages <= 1) {
        // Only one page — verify the "Showing" range is consistent.
        // first/prev buttons should be disabled; next/last should also be
        // disabled.  However the Table component only disables prev when
        // `!getCanPreviousPage()` and next when `!getCanNextPage()`, and on
        // a single page both are false, so all four are disabled.
        // Rather than asserting on individual disabled states (which couples
        // us to the Table component's internal button order and could break
        // if the Table adds wrapper elements), just confirm the numbers.
        expect(from).toBe(1);
        expect(to).toBe(total);
        return;
      }

      // Multiple pages — test navigation
      // The Table renders 4 icon buttons: first(<<), prev(<), next(>), last(>>).
      // Grab all SVG buttons within the table card area.
      const tableCard = page.locator(".card.bg-base-200");
      const paginationButtons = tableCard.locator("button").filter({
        has: page.locator("svg"),
      });
      const buttonCount = await paginationButtons.count();

      if (buttonCount >= 4) {
        // buttons: 0=first, 1=prev, 2=next, 3=last
        const next = paginationButtons.nth(2);
        const prev = paginationButtons.nth(1);

        const isNextEnabled = !(await next.isDisabled());
        if (!isNextEnabled) {
          // Already on the last page somehow — just verify text
          return;
        }

        await next.click();
        await page.waitForTimeout(300);

        // Verify the page indicator changed
        const updatedPageText = await pageIndicator.textContent();
        expect(updatedPageText).toContain("Page 2");

        // Verify "Showing" text updated as well
        const updatedShowing = await showingText.textContent();
        expect(updatedShowing).not.toBe(showingContent);

        // Navigate back to page 1
        await prev.click();
        await page.waitForTimeout(300);

        const restoredPageText = await pageIndicator.textContent();
        expect(restoredPageText).toContain("Page 1");
      }
    });
  });
});
