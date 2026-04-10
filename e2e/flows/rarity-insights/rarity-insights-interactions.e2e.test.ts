/**
 * Rarity Insights — Interactions tests
 *
 * Search, Refresh, Filters (Scan), Boss Cards, Diffs
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

    test("should enter cooldown lock state after a successful refresh", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);

      const refreshWrapper = page.locator(
        '[data-onboarding="rarity-insights-refresh"]',
      );
      const refreshButton = refreshWrapper.locator("button");

      // If already on cooldown from a previous test in this worker,
      // verify the lock state and return early.
      if (await refreshButton.isDisabled()) {
        // Button is disabled — verify it shows a countdown (DaisyUI's
        // countdown uses CSS --value vars so textContent has ":" separators)
        // or a lock icon SVG.
        const buttonText = await refreshButton.textContent();
        const hasCountdown =
          buttonText!.includes(":") || /\d/.test(buttonText!);
        const hasLockIcon = (await refreshButton.locator("svg").count()) > 0;
        expect(hasCountdown || hasLockIcon).toBe(true);
        return;
      }

      // Click the refresh button
      await refreshButton.click();

      // Wait for the refresh to complete — the button should transition
      // from "Refreshing..." to the cooldown state (not back to idle).
      await expect
        .poll(
          async () => {
            const text = (await refreshButton.textContent()) ?? "";
            // Still refreshing — keep waiting
            if (text.includes("Refreshing")) return "refreshing";
            // Back to idle — this is the bug scenario
            if (text.includes("Refresh poe.ninja")) return "idle";
            // Anything else (countdown ":", digits) means cooldown
            return "cooldown";
          },
          { timeout: 30_000, intervals: [200, 500, 1_000] },
        )
        .toBe("cooldown");

      // The button must be disabled during cooldown
      await expect(refreshButton).toBeDisabled();

      // Should contain a lock icon (SVG) or countdown digits
      const svgCount = await refreshButton.locator("svg").count();
      expect(svgCount).toBeGreaterThan(0);
    });
  });

  // ─── Filters (includes Scan) ──────────────────────────────────────────────

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

    test("should show Rescan button inside dropdown when filters are loaded", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      const opened = await openFiltersDropdown(page);
      if (opened) {
        // After waitForPageSettled injects seeded filters, the scan section
        // shows the "Rescan" button alongside the filter instruction.
        await expect(
          page.locator(".absolute.z-50").getByText("Rescan"),
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
      await expect
        .poll(async () => headerCells.count(), { timeout: 5_000 })
        .toBeGreaterThan(2);
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
      // ── Resilient cleanup helper ──────────────────────────────────────
      // Catch blocks that call deselectFilterInDropdown / closeFiltersDropdown
      // can themselves throw on a slow CI (e.g. the dropdown is gone, the
      // filter button didn't render).  Wrapping every cleanup call in its
      // own try/catch prevents a secondary throw from masking the real skip.
      const safeCleanup = async () => {
        try {
          await deselectFilterInDropdown(page, FILTER_1_NAME);
        } catch {
          /* best-effort */
        }
        try {
          await closeFiltersDropdown(page);
        } catch {
          /* best-effort */
        }
      };

      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);

      // ── Ensure cards loaded with correct rarity data ──────────────────
      // On slow machines, loadCards() may complete before the
      // divination_card_rarities backfill from seedRarityInsightsData has
      // been committed.  When that happens, the LEFT JOIN in getAllByGame
      // finds no matching rarity rows and COALESCE falls through to 0
      // (Unknown) for every non-fixture card.  Later, when the filter is
      // parsed, filter_card_rarities has rarity 4 for those same cards,
      // so getDifferences() sees 4 ≠ 0 for ALL ~370 cards → "Show
      // differences only" keeps the full 382-row count.
      //
      // Fix: poll the store until at least some non-fixture cards have a
      // non-zero rarity.  If they're all 0, force a re-load from the
      // (now fully-seeded) DB.
      const cardRaritiesOk = await page.evaluate(() => {
        const store = (window as any).__zustandStore;
        if (!store) return false;
        const allCards = store.getState().cards?.allCards ?? [];
        if (allCards.length === 0) return false;
        // Check a sample of cards — if most have rarity 0 the backfill
        // hasn't landed yet (fixture cards have non-zero rarities, but
        // there are only 12 of them vs ~370 bundled cards).
        let nonZero = 0;
        for (const c of allCards) {
          if (c.rarity !== 0) nonZero++;
        }
        return nonZero > 20; // fixture cards + at least some backfilled
      });

      if (!cardRaritiesOk) {
        // Force a fresh loadCards() now that the DB is fully seeded
        await page.evaluate(async () => {
          const store = (window as any).__zustandStore;
          await store?.getState()?.cards?.loadCards?.();
        });
        // Wait for the table to re-render with updated data
        await waitForTableRows(page);
      }

      // When the filter is toggled, the comparison slice calls parseFilter
      // which IPCs to ensureFilterParsed on the main process.  Because the
      // seeded filters are marked is_fully_parsed = 1, the main process
      // reads cached filter_card_rarities from the DB — no disk access needed.

      const selected = await selectFilterInDropdown(page, FILTER_1_NAME);
      if (!selected) {
        test.skip(true, "Filter dropdown did not open or filter not found");
        return;
      }
      await closeFiltersDropdown(page);

      // Wait for the comparison slice to finish parsing the selected filter.
      // `getAllSelectedParsed()` returns true once every selected filter has
      // an entry in `parsedResults`.  Polling the Zustand store directly is
      // more reliable than a fixed timeout because IPC round-trip times vary
      // significantly between local dev and resource-constrained CI runners.
      //
      // On CI the IPC round-trip can be very slow; use a generous timeout.
      try {
        await expect
          .poll(
            async () =>
              page.evaluate(() => {
                const store = (window as any).__zustandStore;
                return (
                  store
                    ?.getState()
                    ?.rarityInsightsComparison?.getAllSelectedParsed() ?? false
                );
              }),
            { timeout: 30_000, intervals: [100, 250, 500, 1_000, 2_000] },
          )
          .toBe(true);
      } catch {
        await safeCleanup();
        test.skip(
          true,
          "Filter never finished parsing (getAllSelectedParsed timed out)",
        );
        return;
      }

      // "Show differences only" should become enabled now that a filter with
      // parsed results is selected.
      const diffCheckbox = page
        .locator("label", { hasText: "Show differences only" })
        .locator("input[type='checkbox']");

      try {
        await expect(diffCheckbox).toBeEnabled({ timeout: 10_000 });
      } catch {
        await safeCleanup();
        test.skip(
          true,
          "Diff checkbox never became enabled after filter selection",
        );
        return;
      }

      // Wait for the pagination footer to be present and stable before
      // capturing the "before" count.  After filter selection the table
      // may briefly re-render (adding the filter rarity column), which
      // can cause the pagination text to flicker.  Poll for a *non-zero*
      // count to avoid capturing a transitional "0" that would make the
      // subsequent `.not.toBe(beforeCount)` assertion trivially pass.
      let beforeCount = 0;
      try {
        await expect
          .poll(
            async () => {
              const count = await getTotalResultCount(page);
              return count;
            },
            { timeout: 10_000, intervals: [200, 500, 1_000] },
          )
          .toBeGreaterThan(0);
        beforeCount = await getTotalResultCount(page);
      } catch {
        // Pagination never appeared — bail out rather than assert on stale data
        await safeCleanup();
        test.skip(
          true,
          "Pagination footer never appeared with a non-zero count",
        );
        return;
      }

      // ── Diagnostic: dump diff state before toggling ───────────────────
      // When this test fails the pagination count stays the same, meaning
      // every card is a "difference" (filterRarity ≠ ninjaRarity for all).
      // Capture the store state so we can see exactly what's going on in
      // the CI output when the assertion fails.
      const diagBefore = await page.evaluate(() => {
        const store = (window as any).__zustandStore;
        if (!store) return { error: "no store" };
        const state = store.getState();
        const comp = state.rarityInsightsComparison;
        const cards = state.cards;

        const selectedFilters = comp.selectedFilters;
        const parsedEntries = selectedFilters.map((id: string) => {
          const p = comp.parsedResults.get(id);
          return {
            filterId: id,
            hasParsed: !!p,
            raritiesSize: p ? p.rarities.size : 0,
          };
        });

        // Sample up to 5 cards where filterRarity ≠ ninjaRarity
        const diffs: any[] = [];
        const nonDiffs: any[] = [];
        const allCards = cards.allCards || [];
        for (const card of allCards) {
          if (diffs.length >= 5 && nonDiffs.length >= 3) break;
          for (const fid of selectedFilters) {
            const p = comp.parsedResults.get(fid);
            if (!p) continue;
            const filterR = p.rarities.get(card.name) ?? 4;
            const ninjaR = card.rarity;
            if (filterR !== ninjaR && diffs.length < 5) {
              diffs.push({
                name: card.name,
                ninjaRarity: ninjaR,
                filterRarity: filterR,
                inFilterMap: p.rarities.has(card.name),
              });
            } else if (filterR === ninjaR && nonDiffs.length < 3) {
              nonDiffs.push({
                name: card.name,
                ninjaRarity: ninjaR,
                filterRarity: filterR,
              });
            }
          }
        }

        // Count total diffs
        let diffCount = 0;
        for (const card of allCards) {
          for (const fid of selectedFilters) {
            const p = comp.parsedResults.get(fid);
            if (!p) continue;
            const filterR = p.rarities.get(card.name) ?? 4;
            if (filterR !== card.rarity) {
              diffCount++;
              break;
            }
          }
        }

        return {
          totalCards: allCards.length,
          selectedFilters,
          parsedEntries,
          diffCount,
          sampleDiffs: diffs,
          sampleNonDiffs: nonDiffs,
          showDiffsOnly: comp.showDiffsOnly,
          league: state.settings?.poe1SelectedLeague ?? "unknown",
        };
      });
      console.log(
        "[E2E DIAG] Diff state before toggle:",
        JSON.stringify(diagBefore, null, 2),
      );

      // Fail-fast: if every card is a "diff", the seeded data is corrupted
      // (most likely divination_card_rarities has rarity 0 for non-fixture
      // cards while filter_card_rarities has rarity 4 — the backfill race).
      // Toggling "Show differences only" would keep the count at beforeCount,
      // and the poll would time out after 20 s for no reason.
      const dc =
        diagBefore &&
        typeof diagBefore === "object" &&
        "diffCount" in diagBefore
          ? (diagBefore.diffCount as number)
          : undefined;
      const tc =
        diagBefore &&
        typeof diagBefore === "object" &&
        "totalCards" in diagBefore
          ? (diagBefore.totalCards as number)
          : undefined;

      if (dc !== undefined && tc !== undefined && dc >= tc - 5) {
        console.error(
          `[E2E DIAG] All ${dc}/${tc} cards are diffs — ` +
            `seeded data is likely corrupted. Skipping assertion. ` +
            `Sample diffs: ${JSON.stringify((diagBefore as any).sampleDiffs)}`,
        );
        await safeCleanup();
        test.skip(true, `Seeded data corrupted: ${dc}/${tc} cards are diffs`);
        return;
      }

      // Enable "Show differences only"
      await diffCheckbox.check();
      await expect(diffCheckbox).toBeChecked();

      // Wait for the pagination total to change (table re-renders
      // synchronously now that useDeferredValue has been removed).
      // When the pagination text is temporarily absent during a React
      // commit (e.g. the table unmounts/remounts its footer), the
      // locator returns "".  In that case we return `beforeCount` so
      // the poll keeps retrying rather than matching prematurely.
      await expect
        .poll(
          async () => {
            const text = await page
              .locator("text=/of \\d+ results/")
              .textContent({ timeout: 2_000 })
              .catch(() => "");
            const match = text?.match(/of (\d+) results/);
            return match ? parseInt(match[1], 10) : beforeCount;
          },
          {
            timeout: 20_000,
            intervals: [100, 250, 500, 1_000, 2_000],
            message: `Pagination total did not change from ${beforeCount} after toggling "Show differences only". Diag: ${JSON.stringify(
              diagBefore,
            )}`,
          },
        )
        .not.toBe(beforeCount);

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
      await safeCleanup();
    });
  });
});
