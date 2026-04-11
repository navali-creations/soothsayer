/**
 * E2E Test: Profit Forecast – UI & Modal
 *
 * Functional tests for the Profit Forecast page (/profit-forecast) covering:
 *
 *   1. How It Works Modal — open via help button, close via "Got it", close via backdrop
 *   2. Search & Filter — debounced search input filters table rows by card name
 *   3. Hide Anomalous & Low Confidence — checkbox toggles filter table rows
 *   4. Card Navigation — clicking a card name link navigates to /cards/$cardSlug
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Uses `seedSessionPrerequisites` + `seedLeagueCache` to populate a league,
 *   snapshot, card prices, AND the UI league dropdown so `fetchData` fires
 * - Table rows require both seeded snapshot prices AND Prohibited Library
 *   weights (auto-loaded from the bundled CSV at app startup)
 *
 * @module e2e/flows/profit-forecast/profit-forecast-structure
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../../helpers/electron-test";
import {
  ensurePostSetup,
  getCurrentRoute,
  goToProfitForecast,
  navigateTo,
} from "../../helpers/navigation";
import {
  resetLeagueToFixture,
  seedLeagueCache,
  seedSessionPrerequisites,
} from "../../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Wait for the profit-forecast data to finish loading.
 *
 * The page goes through several phases on first visit:
 *
 *   Phase 0 — **Pre-fetch flash** (≤ 1 frame):
 *     `isLoading = false`, `rows = []`.  The `useEffect` hasn't fired yet,
 *     so the table renders "No cards match the current filters."  We must
 *     NOT treat this as a settled state.
 *
 *   Phase 1 — **Loading**:
 *     `fetchData` sets `isLoading = true`.  A large spinner with text
 *     "Loading profit forecast data..." appears.
 *
 *   Phase 2 — **Settled**:
 *     `isLoading = false`, rows are populated (or a genuine empty-state
 *     banner is shown).
 *
 * Strategy: first wait for the loading indicator to **appear** (phase 0 → 1),
 * then wait for it to **disappear** (phase 1 → 2), then wait for the table
 * to have rows or a genuine "No Prohibited Library data" empty-state.
 */
async function waitForDataSettled(page: Page) {
  // 1. Wait for the loading spinner / text to appear.
  //    It may appear very briefly, so use a short timeout and don't fail
  //    if we miss it — the data may load near-instantly on repeat visits
  //    within the same worker.
  try {
    await page
      .getByText("Loading profit forecast data...")
      .waitFor({ state: "visible", timeout: 3_000 });
  } catch {
    // Already past the loading phase — continue.
  }

  // 2. Wait for the loading indicator to disappear (fetch settled).
  await expect(page.locator(".loading.loading-spinner.loading-lg")).toHaveCount(
    0,
    { timeout: 20_000 },
  );

  // 3. Wait for the table to populate OR a genuine empty-state.
  //    We explicitly exclude "No cards match the current filters" because
  //    that text can flash during the pre-fetch frame (phase 0).  Instead
  //    we wait for either table rows or the "No Prohibited Library data"
  //    banner which only appears after a real fetch completes with 0 weights.
  await expect
    .poll(
      async () => {
        const rowCount = await page.locator("table tbody tr").count();
        if (rowCount > 0) return true;

        // The default view is "chart" — if the chart has rendered, data is settled.
        const chartVisible = await page
          .locator('[data-testid="pf-breakeven-chart"]')
          .count();
        if (chartVisible > 0) return true;

        // Genuine empty-states that prove the fetch ran and returned no data
        const text = (await page.locator("main").textContent()) ?? "";
        if (text.includes("No Prohibited Library data")) return true;
        if (text.includes("No snapshot")) return true;
        if (text.includes("No price data")) return true;

        return false;
      },
      { timeout: 20_000, intervals: [100, 200, 500, 1_000] },
    )
    .toBe(true);
}

// Module-level flag so we only seed data once per worker.
let dataSeeded = false;

/**
 * Seed all prerequisite data exactly once per worker.
 *
 * Seeds:
 * - `leagues` table (for the snapshot pipeline)
 * - `poe_leagues_cache` table (for the UI league dropdown — without this
 *   `getActiveGameViewSelectedLeague()` returns "Standard" which is fine,
 *   but having the cache means the league dropdown renders correctly)
 * - `snapshots` table
 * - `snapshot_card_prices` table (8 sample cards)
 *
 * Uses `INSERT OR IGNORE` / `INSERT OR REPLACE` so it's safe to call
 * repeatedly within the same worker — subsequent calls are no-ops.
 */
async function ensureDataSeeded(page: Page) {
  if (dataSeeded) return;

  try {
    await seedSessionPrerequisites(page);
  } catch {
    // May already be seeded from a previous test in this worker
  }

  // Also seed the league cache so the UI league dropdown is populated.
  // Without this the league selector may be empty (cosmetic issue — the
  // selected league still defaults to "Standard" from settings).
  try {
    await seedLeagueCache(page, {
      game: "poe1",
      leagueId: "Standard",
      name: "Standard",
    });
  } catch {
    // Already seeded — fine.
  }

  dataSeeded = true;
}

/**
 * Navigate to /profit-forecast and wait for the table to be populated.
 *
 * Bounces through "/" first if already on /profit-forecast to force a
 * component re-mount (see comment below).
 */
async function navigateToForecast(page: Page) {
  // Navigate away from /profit-forecast first, then back.
  //
  // The modal tests (which run before the data tests in this file) may have
  // already visited /profit-forecast **before** any data was seeded.  That
  // initial visit triggered `fetchData` via the page's useEffect, which
  // completed with 0 rows (no snapshot existed yet).
  //
  // If we navigate straight to /profit-forecast now, React sees the same
  // route + same `game` + same `league` and does NOT re-fire the useEffect —
  // the store still holds the stale 0-row result.
  //
  // By bouncing through "/" first we unmount the ProfitForecastPage component.
  // When we then navigate to /profit-forecast the component re-mounts, its
  // useEffect fires afresh, and `fetchData` picks up the newly-seeded data.
  const currentRoute = await getCurrentRoute(page);
  if (currentRoute === "/profit-forecast") {
    await navigateTo(page, "/");
  }

  await goToProfitForecast(page);
  await waitForDataSettled(page);

  // Switch to Table view for tests that interact with table rows
  const tableTab = page.getByRole("button", { name: "Table" });
  await tableTab.click();

  // Wait for the table to actually have rows after switching view
  await expect
    .poll(async () => page.locator("table tbody tr").count(), {
      timeout: 10_000,
      intervals: [100, 200, 500],
    })
    .toBeGreaterThan(0);
}

/**
 * Ensure the PFHelpModal is open. If it's already open (from a previous test
 * in the same worker) we return immediately. Otherwise we click the help button.
 *
 * The button is rendered by PFHeaderActions as:
 *   <Button variant="ghost" size="sm" className="gap-1">
 *     <FiHelpCircle className="w-4 h-4" />
 *   </Button>
 *
 * It lives inside `<main>` (the page content area). We scope to `main` to
 * avoid hitting identically-styled sidebar icon buttons (e.g. overlay toggle).
 */
async function openHelpModal(page: Page) {
  // If the modal is already open (left over from a previous test), skip clicking.
  const alreadyOpen = await page
    .getByText("Profit Forecast — How It Works")
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (alreadyOpen) return;

  // Close any other dialog that might be covering the page (e.g. "What's New").
  await page
    .evaluate(() => {
      document.querySelectorAll("dialog[open]").forEach((d) => {
        (d as HTMLDialogElement).close();
      });
    })
    .catch(() => {});
  await expect(page.locator("dialog[open]")).toHaveCount(0, { timeout: 2_000 });

  // The help button is inside main, has class gap-1, contains an SVG with
  // class w-4 h-4 (the FiHelpCircle icon), and has no visible text.
  const helpBtn = page
    .locator("main button.btn-ghost.btn-sm.gap-1")
    .filter({ has: page.locator("svg.w-4.h-4") })
    .first();

  await helpBtn.waitFor({ state: "visible", timeout: 5_000 });
  await helpBtn.click();

  // Wait for the modal heading to confirm it opened
  await page
    .getByText("Profit Forecast — How It Works")
    .waitFor({ state: "visible", timeout: 5_000 });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Profit Forecast – UI & Modal", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await resetLeagueToFixture(page, "Standard");
    await ensureDataSeeded(page);
  });

  // ── How It Works Modal ──────────────────────────────────────────────────
  //
  // These tests do NOT require seeded data — the modal is purely UI.

  test.describe("How It Works Modal", () => {
    test("should open the How It Works modal when help button is clicked", async ({
      page,
    }) => {
      await goToProfitForecast(page);

      // Click the help button in the header actions area
      await openHelpModal(page);

      // The PFHelpModal renders: <dialog className="modal modal-open">
      const heading = page.getByText("Profit Forecast — How It Works");
      await expect(heading).toBeVisible({ timeout: 5_000 });

      // The dialog should be present with modal-open class
      const modal = page.locator("dialog.modal.modal-open");
      await expect(modal).toBeVisible();

      // Assert the "Got it" button is present inside the modal
      const gotItButton = modal.getByRole("button", { name: "Got it" });
      await expect(gotItButton).toBeVisible();

      // Clean up: close the modal so subsequent tests start from a clean state
      await gotItButton.click();
      await expect(heading).toBeHidden({ timeout: 5_000 });
    });

    test("should close the modal when Got it button is clicked", async ({
      page,
    }) => {
      await goToProfitForecast(page);

      // Open the modal
      await openHelpModal(page);

      // Wait for heading to prove modal is open
      const heading = page.getByText("Profit Forecast — How It Works");
      await expect(heading).toBeVisible({ timeout: 5_000 });

      const modal = page.locator("dialog.modal.modal-open");

      // Click the "Got it" button
      const gotItButton = modal.getByRole("button", { name: "Got it" });
      await gotItButton.click();

      // Assert the modal heading is gone (component returns null when closed)
      await expect(heading).toBeHidden({ timeout: 5_000 });
    });

    test("should close the modal when clicking outside (backdrop)", async ({
      page,
    }) => {
      await goToProfitForecast(page);

      // Open the modal
      await openHelpModal(page);

      // Wait for heading to prove modal is open
      const heading = page.getByText("Profit Forecast — How It Works");
      await expect(heading).toBeVisible({ timeout: 5_000 });

      // Click outside the modal-box to close it.  The PFHelpModal renders:
      //   <dialog className="modal modal-open" onClick={onClose}>
      //     <div className="modal-box" onClick={e => e.stopPropagation()}>…</div>
      //     <form className="modal-backdrop"><button onClick={onClose}>close</button></form>
      //   </dialog>
      //
      // Playwright's `.click()` with coordinates or `force: true` doesn't
      // reliably hit the backdrop area because DaisyUI's `.modal` uses a
      // full-viewport overlay with pointer-events tricks.  Instead we
      // dispatch a synthetic click directly on the <dialog> element —
      // React's onClick handler on the dialog will fire onClose.
      await page.evaluate(() => {
        const dialog = document.querySelector("dialog.modal.modal-open");
        if (dialog) {
          dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        }
      });

      // Assert the modal is no longer visible
      await expect(heading).toBeHidden({ timeout: 5_000 });
    });
  });

  // ── Search & Filter ─────────────────────────────────────────────────────
  //
  // All tests below require seeded data and a populated table.  Data is
  // seeded once in `beforeEach` via `ensureDataSeeded`; each test calls
  // `navigateToForecast` to (re-)mount the page and asserts that the table
  // has rows before proceeding — if the table is empty something is
  // genuinely wrong and the test should fail loudly rather than silently
  // early-return.

  test.describe("Search & Filter", () => {
    test("should filter table rows when searching for a card name", async ({
      page,
    }) => {
      await navigateToForecast(page);

      const tableRows = page.locator("table tbody tr");
      const initialRowCount = await tableRows.count();

      // The table must have rows — PL weights are auto-loaded from the bundled
      // CSV and we've seeded snapshot prices, so data should be present.
      expect(initialRowCount).toBeGreaterThan(0);

      // Type "Doctor" in the search input (debounced 300ms)
      const searchInput = page.locator('input[placeholder="Search cards..."]');
      await expect(searchInput).toBeVisible({ timeout: 5_000 });
      await searchInput.fill("Doctor");

      // Wait for the debounce (300ms) + React deferred re-render to settle.
      // A fixed timeout is unreliable under load — poll until the row count
      // actually changes from the initial value.
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 10_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBeLessThan(initialRowCount);

      // The table should now show fewer rows (only rows matching "Doctor")
      const filteredRowCount = await tableRows.count();
      expect(filteredRowCount).toBeLessThan(initialRowCount);
      expect(filteredRowCount).toBeGreaterThan(0);

      // Every visible row should contain "doctor" (case-insensitive)
      const rowTexts = await tableRows.allTextContents();
      for (const text of rowTexts) {
        expect(text.toLowerCase()).toContain("doctor");
      }

      // Clear the search and verify all rows return
      await searchInput.clear();

      // Poll until the row count is restored — same rationale as above.
      await expect
        .poll(async () => page.locator("table tbody tr").count(), {
          timeout: 10_000,
          intervals: [100, 200, 500, 1_000],
        })
        .toBe(initialRowCount);

      const restoredRowCount = await tableRows.count();
      expect(restoredRowCount).toBe(initialRowCount);
    });
  });

  // ── Hide Anomalous & Low Confidence ─────────────────────────────────────

  test.describe("Hide Anomalous & Low Confidence", () => {
    test("hide anomalous checkbox filters table rows when anomalous cards exist", async ({
      page,
    }) => {
      await navigateToForecast(page);

      const tableRows = page.locator("table tbody tr");
      const initialRowCount = await tableRows.count();
      expect(initialRowCount).toBeGreaterThan(0);

      // Check if the "Hide anomalous prices" checkbox is visible — it only
      // renders when the service's anomaly detection flags at least one card.
      const anomalousCheckbox = page.locator("input.checkbox-error");
      const isAnomalousVisible = await anomalousCheckbox
        .isVisible({ timeout: 2_000 })
        .catch(() => false);

      if (!isAnomalousVisible) {
        // No anomalous cards in current data — verify the checkbox is absent
        // which is the correct behavior when no anomalous cards exist.
        await expect(anomalousCheckbox).toBeHidden();
        return;
      }

      // Check the box to hide anomalous rows
      await anomalousCheckbox.check();
      await expect
        .poll(async () => tableRows.count(), {
          timeout: 3_000,
          intervals: [100, 200],
        })
        .toBeLessThan(initialRowCount);

      // Uncheck — rows should return
      await anomalousCheckbox.uncheck();
      await expect(tableRows).toHaveCount(initialRowCount, { timeout: 3_000 });
    });

    test("hide low confidence checkbox filters table rows when low confidence cards exist", async ({
      page,
    }) => {
      await navigateToForecast(page);

      const tableRows = page.locator("table tbody tr");
      const initialRowCount = await tableRows.count();
      expect(initialRowCount).toBeGreaterThan(0);

      // The "Hide low confidence prices" checkbox must be visible because
      // seedSessionPrerequisites seeds cards with confidence === 3.
      const lowConfCheckbox = page.locator("input.checkbox-warning");
      await expect(lowConfCheckbox).toBeVisible({ timeout: 5_000 });

      // Check the box to hide low confidence rows
      await lowConfCheckbox.check();
      await expect
        .poll(async () => tableRows.count(), {
          timeout: 3_000,
          intervals: [100, 200],
        })
        .toBeLessThan(initialRowCount);

      // Uncheck — rows should return
      await lowConfCheckbox.uncheck();
      await expect(tableRows).toHaveCount(initialRowCount, { timeout: 3_000 });
    });
  });

  // ── Card Navigation ─────────────────────────────────────────────────────

  test.describe("Card Navigation", () => {
    test("clicking a card name in the table navigates to card details", async ({
      page,
    }) => {
      await navigateToForecast(page);

      const tableRows = page.locator("table tbody tr");
      const rowCount = await tableRows.count();
      expect(rowCount).toBeGreaterThan(0);

      // Find a card name link in the table — CardNameLink renders as <a> tags
      // with TanStack Router `to="/cards/$cardSlug"`
      const cardLink = page.locator("table tbody tr a").first();
      await expect(cardLink).toBeVisible({ timeout: 3_000 });

      const cardName = await cardLink.textContent();
      expect(cardName).toBeTruthy();

      // Click the card name link
      await cardLink.click();

      // Wait for navigation to settle
      await expect
        .poll(async () => page.evaluate(() => window.location.hash), {
          timeout: 5_000,
        })
        .toMatch(/^#\/cards\//);

      // Verify the card detail page loaded
      const main = page.locator("main");
      await expect(main).toBeVisible({ timeout: 5_000 });
    });
  });
});
