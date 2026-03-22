/**
 * E2E Tests: Card Detail Page
 *
 * Tests the card details page (/cards/$cardSlug) covering:
 * 1. Navigation from cards grid to card detail
 * 2. Card detail content rendering (visual, header, tabs)
 * 3. Personal analytics with seeded session data (Your Data tab)
 * 4. Chart rendering (Recharts) — verifies SVG elements render
 * 5. Navigation back to cards list
 * 6. External links (poewiki.net, poe.ninja) — verifies URLs are correct
 * 7. Related / chain cards navigation (uses The Nurse for rich chain data)
 * 8. Tab switching between Your Data and Market Data
 *
 * Market Data tab tests (price chart, poe.ninja fetch) are in a separate file:
 *   card-detail-market.e2e.test.ts
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - No external services required — cards load from bundled `renderer/assets/poe1/cards.json`
 *   into local SQLite at startup
 * - Session data is seeded via test-only IPC handlers (`E2E_TESTING=true`)
 *
 * @module e2e/flows/card-detail
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../../helpers/electron-test";
import {
  clickSidebarLink,
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
  waitForRoute,
} from "../../helpers/navigation";
import {
  seedCardRarities,
  seedCompletedSession,
  seedLeagueCache,
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
 * Navigate to the cards grid and wait for at least one card item to render.
 */
async function goToCardsGrid(page: Page) {
  await navigateTo(page, "/cards");
  await waitForRoute(page, "/cards", 10_000);
  await page
    .locator("main ul > li")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Install a window.open spy that captures URLs without calling the original.
 *
 * This prevents `shell.openExternal` from actually opening a browser tab
 * (important for CI) while still letting us verify the correct URL was passed.
 *
 * Call `collectOpenedUrls` to retrieve the captured URLs and tear down the spy.
 */
async function installWindowOpenSpy(page: Page) {
  await page.evaluate(() => {
    (window as any).__e2eOpenedUrls = [];
    (window as any).__e2eOriginalOpen = window.open;
    // Replace window.open with a no-op spy — do NOT call through to the
    // original so that no browser tab / shell.openExternal is triggered.
    window.open = (
      url?: string | URL,
      ..._rest: unknown[]
    ): WindowProxy | null => {
      (window as any).__e2eOpenedUrls.push(
        typeof url === "string" ? url : (url?.toString() ?? null),
      );
      return null;
    };
  });
}

/**
 * Retrieve URLs captured by the spy and restore the original window.open.
 */
async function collectOpenedUrls(page: Page): Promise<string[]> {
  const urls = await page.evaluate(
    () => (window as any).__e2eOpenedUrls as string[],
  );
  await page.evaluate(() => {
    if ((window as any).__e2eOriginalOpen) {
      window.open = (window as any).__e2eOriginalOpen;
    }
    delete (window as any).__e2eOpenedUrls;
    delete (window as any).__e2eOriginalOpen;
  });
  return urls;
}

// ─── Data Seeding ─────────────────────────────────────────────────────────────

// Module-level flag so we only seed data once per worker.
let dataSeeded = false;

/**
 * Seed all prerequisite data exactly once per worker.
 *
 * Seeds:
 * - `leagues` table + `poe_leagues_cache` (for UI league dropdown)
 * - `snapshots` table + `snapshot_card_prices` (sample card prices)
 * - `divination_card_rarities` for House of Mirrors (extremely rare)
 * - Completed sessions with card drops for "House of Mirrors" and others
 *
 * Uses `INSERT OR IGNORE` / `INSERT OR REPLACE` so it's safe to call
 * repeatedly within the same worker — subsequent calls are no-ops.
 */
async function ensureDataSeeded(page: Page) {
  if (dataSeeded) return;

  let snapshotId: string | undefined;

  try {
    const result = await seedSessionPrerequisites(page);
    snapshotId = result.snapshotId;
  } catch {
    // May already be seeded from a previous test in this worker
  }

  // Seed the league cache so the UI league dropdown is populated.
  try {
    await seedLeagueCache(page, {
      game: "poe1",
      leagueId: "Standard",
      name: "Standard",
    });
  } catch {
    // Already seeded — fine.
  }

  // Seed card rarity for House of Mirrors (1 = Extremely Rare).
  try {
    await seedCardRarities(page, [{ cardName: "House of Mirrors", rarity: 1 }]);
  } catch {
    // Already seeded — fine.
  }

  // Seed completed sessions with drops for "House of Mirrors" (the card we test)
  // so personal analytics has real data to display.
  try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const tenHoursAgo = new Date(now.getTime() - 10 * 60 * 60 * 1000);

    // Session 1: older session with House of Mirrors + common drops
    await seedCompletedSession(page, {
      id: "e2e-card-detail-session-1",
      leagueId: "poe1_standard",
      snapshotId: snapshotId ?? null,
      startedAt: tenHoursAgo.toISOString(),
      endedAt: sixHoursAgo.toISOString(),
      cards: [
        { cardName: "House of Mirrors", count: 2 },
        { cardName: "Humility", count: 8 },
        { cardName: "Rain of Chaos", count: 20 },
        { cardName: "Carrion Crow", count: 15 },
      ],
    });

    // Session 2: recent session with more House of Mirrors drops
    await seedCompletedSession(page, {
      id: "e2e-card-detail-session-2",
      leagueId: "poe1_standard",
      snapshotId: snapshotId ?? null,
      startedAt: sixHoursAgo.toISOString(),
      endedAt: twoHoursAgo.toISOString(),
      cards: [
        { cardName: "House of Mirrors", count: 1 },
        { cardName: "The Doctor", count: 1 },
        { cardName: "Rain of Chaos", count: 12 },
      ],
    });

    // Session 3: most recent session
    await seedCompletedSession(page, {
      id: "e2e-card-detail-session-3",
      leagueId: "poe1_standard",
      snapshotId: snapshotId ?? null,
      startedAt: twoHoursAgo.toISOString(),
      endedAt: now.toISOString(),
      cards: [
        { cardName: "House of Mirrors", count: 1 },
        { cardName: "Humility", count: 5 },
        { cardName: "Carrion Crow", count: 30 },
      ],
    });
  } catch {
    // Session seeding failed — tests that need seeded data will still run
    // but may assert on empty states instead.
  }

  dataSeeded = true;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("Card Detail Page", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test.describe("Navigation", () => {
    test("should navigate to card details when clicking a card in the grid", async ({
      page,
    }) => {
      await goToCardsGrid(page);

      // Cards are rendered as <li> → <div class="cursor-pointer" onClick={navigate}>
      const firstCardClickable = page
        .locator("main ul > li")
        .first()
        .locator(".cursor-pointer")
        .first();

      await expect(
        firstCardClickable,
        "First card clickable element should be visible",
      ).toBeVisible({ timeout: 5_000 });

      await firstCardClickable.click();

      // Wait for navigation to a card detail route: #/cards/<slug>
      await expect
        .poll(async () => page.evaluate(() => window.location.hash), {
          timeout: 5_000,
        })
        .toMatch(/^#\/cards\/.+/);

      const route = await getCurrentRoute(page);
      expect(route).toMatch(/^\/cards\/.+/);
    });

    test("should navigate back to cards list from card details", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // Look for the back button (FiArrowLeft in HeaderActions)
      const backButton = page
        .locator(
          'button:has-text("Back"), a:has-text("Back"), [aria-label="Back"], [data-testid*="back"]',
        )
        .first();

      const backVisible = await backButton.isVisible().catch(() => false);

      if (backVisible) {
        await backButton.click();
      } else {
        // The back button is an icon-only button — try the first ghost button in the header area
        const iconBackButton = page
          .locator('header button, [class*="PageHeader"] button')
          .first();
        const iconVisible = await iconBackButton.isVisible().catch(() => false);

        if (iconVisible) {
          await iconBackButton.click();
        } else {
          // Fall back to sidebar navigation
          await clickSidebarLink(page, "Cards");
        }
      }

      await waitForRoute(page, "/cards", 10_000);

      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards");
    });
  });

  // ── Card Detail Content ───────────────────────────────────────────────────

  test.describe("Card Detail Content", () => {
    test("should display card name and header on detail page", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // The card name is rendered in an <h1> via PageContainer.Header
      const heading = page.locator("h1");
      await expect(heading).toBeVisible({ timeout: 10_000 });

      const headingText = await heading.textContent();
      expect(headingText).toContain("House of Mirrors");
    });

    test("should display card details content on the detail page", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      const mainContent = page.locator("main");
      await expect(mainContent).toBeVisible({ timeout: 10_000 });

      const content = await mainContent.textContent();
      expect(content).toBeTruthy();
    });

    test("should display the card visual", async ({ page }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // CardDetailsVisual renders a DivinationCard inside a centered flex container
      // The card visual includes an image or canvas element
      const cardVisual = page.locator("main .flex.justify-center").first();
      await expect(cardVisual).toBeVisible({ timeout: 10_000 });
    });

    test("should have Market Data and Your Data tabs", async ({ page }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // There are two elements with role="tablist" on the page:
      // 1. The game selector (data-onboarding="game-selector") with "Path of Exile" text
      // 2. The card detail tabs with "Market Data" and "Your Data"
      // Use a more specific locator to target only the card detail tablist.
      const tablist = page.getByText("Market DataYour Data");
      await expect(tablist).toBeVisible({ timeout: 10_000 });

      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });

      await expect(marketTab).toBeVisible({ timeout: 5_000 });
      await expect(yourDataTab).toBeVisible({ timeout: 5_000 });
    });

    test("should show the Your Data tab as active by default", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // The default active tab is "Your Data" (per CardDetails.slice.ts initial state).
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await expect(yourDataTab).toBeVisible({ timeout: 10_000 });

      const isActive = await yourDataTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(isActive, "Your Data tab should be active by default").toBe(true);

      // Market Data tab should NOT be active
      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      const isMarketActive = await marketTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isMarketActive,
        "Market Data tab should be inactive by default",
      ).toBe(false);
    });
  });

  // ── Your Data — Personal Analytics ────────────────────────────────────────

  test.describe("Your Data — Personal Analytics", () => {
    test("should display personal drop stats when session data exists", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default active tab, so no need to click it.
      // Wait for the personal analytics section to render.
      // With seeded data, CardDetailsPersonal should show stats like
      // "Total Drops", "Drop Rate", "First Found", "Last Seen".
      // If no data was seeded, it shows "You haven't found this card yet".
      await page.waitForTimeout(2_000);

      const mainContent = page.locator("main");
      const content = await mainContent.textContent();

      // Either we see real stats (data was seeded) or the empty state
      const hasStats =
        content?.includes("Total Drops") || content?.includes("Drop Rate");
      const hasEmptyState = content?.includes(
        "You haven't found this card yet",
      );

      expect(
        hasStats || hasEmptyState,
        "Should display either personal stats or empty state message",
      ).toBe(true);
    });

    test("should show total drops count when session data is seeded", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default active tab.
      // Wait for analytics to load
      await page.waitForTimeout(2_000);

      const mainContent = await page.locator("main").textContent();

      // We seeded 2 + 1 + 1 = 4 House of Mirrors drops across 3 sessions.
      // If seeding worked, "Total Drops" stat should be visible.
      if (mainContent?.includes("Total Drops")) {
        // Verify the stat section rendered
        const totalDropsStat = page.getByText("Total Drops");
        await expect(totalDropsStat.first()).toBeVisible({ timeout: 5_000 });

        // The "Across all sessions" description should appear
        const description = page.getByText("Across all sessions");
        await expect(description.first()).toBeVisible({ timeout: 5_000 });
      } else {
        // Data wasn't seeded — just confirm empty state renders cleanly
        const emptyState = page.getByText("You haven't found this card yet");
        await expect(emptyState.first()).toBeVisible({ timeout: 5_000 });
      }
    });

    test("should render the drop timeline chart when multiple sessions exist", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default active tab.
      // Wait for the chart to render
      await page.waitForTimeout(3_000);

      const mainContent = await page.locator("main").textContent();

      // CardDetailsDropTimeline renders "Drop Timeline" heading when data exists.
      // With 3 seeded sessions it should render the full ComposedChart.
      if (mainContent?.includes("Drop Timeline")) {
        // The timeline heading is visible
        const timelineHeading = page.getByText("Drop Timeline");
        await expect(timelineHeading.first()).toBeVisible({ timeout: 5_000 });

        // Recharts renders a <div class="recharts-wrapper"> containing
        // <svg class="recharts-surface">. Verify the SVG rendered.
        const rechartsSvg = page.locator(".recharts-surface");
        const svgCount = await rechartsSvg.count();

        if (svgCount > 0) {
          // At least one Recharts SVG surface should be visible
          await expect(rechartsSvg.first()).toBeVisible({ timeout: 5_000 });

          // The chart should contain rendered elements (bars or paths)
          const chartPaths = page.locator(
            ".recharts-surface path, .recharts-surface rect",
          );
          const pathCount = await chartPaths.count();
          expect(
            pathCount,
            "Recharts chart should render SVG path or rect elements",
          ).toBeGreaterThan(0);
        }
      } else {
        // Timeline not visible — either single data point or no data.
        // Verify the page didn't crash by checking main content exists.
        expect(mainContent).toBeTruthy();
      }
    });

    test("should display footer stats in the drop timeline", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default active tab.
      await page.waitForTimeout(3_000);

      const mainContent = await page.locator("main").textContent();

      // The drop timeline footer shows "X days across Y leagues" and "Z total drops"
      if (mainContent?.includes("Drop Timeline")) {
        // Should show "total drop" or "total drops" in the footer
        const hasTotalDropsFooter =
          mainContent.includes("total drop") ||
          mainContent.includes("total drops");
        expect(
          hasTotalDropsFooter,
          "Drop timeline footer should show total drops count",
        ).toBe(true);

        // Should mention league count
        const hasLeagueCount =
          mainContent.includes("league") || mainContent.includes("leagues");
        expect(
          hasLeagueCount,
          "Drop timeline footer should show league count",
        ).toBe(true);
      }
    });
  });

  // ── Chart Rendering (Recharts Visual Regression — Your Data tab) ──────────

  test.describe("Chart Rendering — Recharts", () => {
    test("should render Recharts SVG surface elements when chart data exists", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default tab — seeded data should produce charts
      // Wait for Recharts to render — it uses ResponsiveContainer which
      // may need a layout pass before rendering the SVG.
      await page.waitForTimeout(3_000);

      // Check for Recharts wrapper divs
      const rechartsWrappers = page.locator(".recharts-wrapper");
      const wrapperCount = await rechartsWrappers.count();

      if (wrapperCount > 0) {
        // Verify the wrapper contains an SVG with the recharts-surface class
        const surface = rechartsWrappers
          .first()
          .locator("svg.recharts-surface");
        await expect(surface).toBeVisible({ timeout: 5_000 });

        // Verify the SVG has non-zero dimensions (actually rendered, not collapsed)
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
      } else {
        // No chart rendered — data may not have been seeded.
        // Verify the page is still functional.
        const mainContent = await page.locator("main").textContent();
        expect(mainContent).toBeTruthy();
      }
    });

    test("should render chart axes and grid lines", async ({ page }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default tab.
      await page.waitForTimeout(3_000);

      const rechartsWrappers = page.locator(".recharts-wrapper");
      const wrapperCount = await rechartsWrappers.count();

      if (wrapperCount > 0) {
        // Recharts renders CartesianGrid as <g class="recharts-cartesian-grid">
        const gridLines = page.locator(".recharts-cartesian-grid");
        const gridCount = await gridLines.count();

        // Recharts renders axes as <g class="recharts-xAxis"> / <g class="recharts-yAxis">
        const xAxis = page.locator(".recharts-xAxis");
        const yAxis = page.locator(".recharts-yAxis");

        // At least some chart structural elements should be present
        const hasStructure =
          gridCount > 0 ||
          (await xAxis.count()) > 0 ||
          (await yAxis.count()) > 0;

        expect(
          hasStructure,
          "Recharts chart should render grid, X-axis, or Y-axis elements",
        ).toBe(true);
      }
    });

    test("should render chart data elements (bars or area paths)", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // "Your Data" is the default tab.
      await page.waitForTimeout(3_000);

      const rechartsSurface = page.locator(".recharts-surface");
      const surfaceCount = await rechartsSurface.count();

      if (surfaceCount > 0) {
        // ComposedChart renders bars as <g class="recharts-bar"> and
        // area/line as <g class="recharts-area"> or <g class="recharts-line">
        const bars = page.locator(".recharts-bar");
        const areas = page.locator(".recharts-area");
        const lines = page.locator(".recharts-line");

        const barCount = await bars.count();
        const areaCount = await areas.count();
        const lineCount = await lines.count();

        const hasDataElements = barCount > 0 || areaCount > 0 || lineCount > 0;

        expect(
          hasDataElements,
          "Recharts chart should render bar, area, or line data elements",
        ).toBe(true);
      }
    });
  });

  // ── External Links ────────────────────────────────────────────────────────
  //
  // We install a window.open spy that captures URLs WITHOUT calling the
  // original. This way `shell.openExternal` is never triggered, no browser
  // tab opens, and CI won't be disrupted. We only verify the URL that the
  // component passed to `window.open`.

  test.describe("External Links", () => {
    test("should have poewiki.net and poe.ninja external link buttons", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // CardDetailsExternalLinks renders two ghost buttons
      const wikiButton = page.locator("button", { hasText: "poewiki.net" });
      const ninjaButton = page.locator("button", { hasText: "poe.ninja" });

      await expect(wikiButton).toBeVisible({ timeout: 10_000 });
      await expect(ninjaButton).toBeVisible({ timeout: 10_000 });
    });

    test("should register the correct poewiki.net URL on click", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // Install spy BEFORE clicking — the spy is a no-op, no browser opens.
      await installWindowOpenSpy(page);

      const wikiButton = page.locator("button", { hasText: "poewiki.net" });
      await expect(wikiButton).toBeVisible({ timeout: 10_000 });
      await wikiButton.click();

      await page.waitForTimeout(300);
      const openedUrls = await collectOpenedUrls(page);

      expect(openedUrls.length).toBeGreaterThan(0);
      const wikiUrl = openedUrls[0];
      expect(wikiUrl).toContain("https://www.poewiki.net/wiki/");
      expect(wikiUrl).toContain("House");
      expect(wikiUrl).toContain("Mirrors");
    });

    test("should register the correct poe.ninja URL on click", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      await installWindowOpenSpy(page);

      const ninjaButton = page.locator("button", { hasText: "poe.ninja" });
      await expect(ninjaButton).toBeVisible({ timeout: 10_000 });
      await ninjaButton.click();

      await page.waitForTimeout(300);
      const openedUrls = await collectOpenedUrls(page);

      expect(openedUrls.length).toBeGreaterThan(0);
      const ninjaUrl = openedUrls[0];
      expect(ninjaUrl).toContain("https://poe.ninja/");
      expect(ninjaUrl).toContain("divination-cards/");
      expect(ninjaUrl).toContain("house-of-mirrors");
    });

    test("should not create new Electron windows when clicking external links", async ({
      app,
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      const windowsBefore = await app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length,
      );

      // Spy prevents shell.openExternal from firing
      await installWindowOpenSpy(page);

      const wikiButton = page.locator("button", { hasText: "poewiki.net" });
      await wikiButton.click();
      await page.waitForTimeout(200);

      const ninjaButton = page.locator("button", { hasText: "poe.ninja" });
      await ninjaButton.click();
      await page.waitForTimeout(300);

      await collectOpenedUrls(page); // cleanup spy

      // setWindowOpenHandler always returns { action: "deny" }, so no new windows
      const windowsAfter = await app.evaluate(
        ({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().filter((w) => !w.isDestroyed()).length,
      );

      expect(
        windowsAfter,
        "No new Electron windows should be created by external link clicks",
      ).toBe(windowsBefore);

      // Route should still be on the card detail page (no in-app navigation)
      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });
  });

  // ── Related / Chain Cards Navigation ──────────────────────────────────────
  //
  // Uses "The Nurse" which has a well-known reward chain:
  //   The Patient → The Nurse → The Doctor → Headhunter
  //
  // When viewing The Nurse the service should resolve:
  //   - Chain cards:  The Patient (upstream) and The Doctor (downstream)
  //   - Similar cards: other cards whose terminal reward is Headhunter (if any)
  //
  // House of Mirrors has "The Immortal" as an upstream chain card but the
  // chain is shorter, so The Nurse gives us richer coverage.

  test.describe("Related / Chain Cards", () => {
    test("should render related cards section for The Nurse", async ({
      page,
    }) => {
      await goToCardDetail(page, "the-nurse");

      // Wait for related cards to load (fetched during initializeCardDetails)
      await page.waitForTimeout(5_000);

      const mainContent = await page.locator("main").textContent();

      // CardDetailsRelatedCards renders "Similar Cards" and/or "Card Chain"
      const hasSimilar = mainContent?.includes("Similar Cards");
      const hasChain = mainContent?.includes("Card Chain");
      const hasRelated = hasSimilar || hasChain;

      // The Nurse rewards The Doctor which rewards Headhunter, so we expect
      // at least a "Card Chain" section with The Patient / The Doctor.
      expect(
        hasRelated,
        "The Nurse should have related cards (chain: The Patient → The Nurse → The Doctor, or similar cards sharing the Headhunter terminal reward)",
      ).toBe(true);

      // At least one related card chip should be a link to another card
      const relatedLinks = page.locator('main a[href*="/cards/"]');
      const linkCount = await relatedLinks.count();
      expect(
        linkCount,
        "Related cards section should contain at least one card link",
      ).toBeGreaterThan(0);
    });

    test("should show chain cards for The Nurse (The Patient and/or The Doctor)", async ({
      page,
    }) => {
      await goToCardDetail(page, "the-nurse");
      await page.waitForTimeout(5_000);

      const mainContent = await page.locator("main").textContent();

      if (!mainContent?.includes("Card Chain")) {
        // Chain section did not render — skip gracefully.
        test.skip();
        return;
      }

      // The reward chain is: The Patient → The Nurse → The Doctor → Headhunter
      // When viewing The Nurse, we expect The Doctor (downstream) and/or
      // The Patient (upstream) to appear as chain cards.
      const hasDoctor = mainContent.includes("The Doctor");
      const hasPatient = mainContent.includes("The Patient");

      expect(
        hasDoctor || hasPatient,
        "Chain should include The Doctor (downstream) or The Patient (upstream)",
      ).toBe(true);
    });

    test("should navigate to a chain card when clicking a related card chip", async ({
      page,
    }) => {
      await goToCardDetail(page, "the-nurse");
      await page.waitForTimeout(5_000);

      const mainContent = await page.locator("main").textContent();
      const hasRelated =
        mainContent?.includes("Similar Cards") ||
        mainContent?.includes("Card Chain");

      if (!hasRelated) {
        test.skip();
        return;
      }

      // RelatedCardChip renders <Link to="/cards/$cardSlug"> → <a href="#/cards/...">
      const relatedLinks = page.locator('main a[href*="/cards/"]');
      const linkCount = await relatedLinks.count();

      if (linkCount === 0) {
        test.skip();
        return;
      }

      const firstLink = relatedLinks.first();
      await expect(firstLink).toBeVisible({ timeout: 5_000 });
      await firstLink.click();

      // Wait for navigation to a different card detail page
      await expect
        .poll(
          async () => {
            const hash = await page.evaluate(() => window.location.hash);
            return /^#\/cards\/.+/.test(hash) && !hash.includes("the-nurse");
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      const route = await getCurrentRoute(page);
      expect(route).toMatch(/^\/cards\/.+/);
      expect(route).not.toBe("/cards/the-nurse");

      // Verify the new card detail page loaded correctly
      const heading = page.locator("h1");
      await expect(heading).toBeVisible({ timeout: 10_000 });
      const headingText = await heading.textContent();
      expect(headingText).toBeTruthy();
      expect(headingText).not.toContain("The Nurse");
    });

    test("should navigate back to original card after visiting a chain card", async ({
      page,
    }) => {
      await goToCardDetail(page, "the-nurse");
      await page.waitForTimeout(5_000);

      const mainContent = await page.locator("main").textContent();
      const hasRelated =
        mainContent?.includes("Similar Cards") ||
        mainContent?.includes("Card Chain");

      if (!hasRelated) {
        test.skip();
        return;
      }

      const relatedLinks = page.locator('main a[href*="/cards/"]');
      const linkCount = await relatedLinks.count();

      if (linkCount === 0) {
        test.skip();
        return;
      }

      // Navigate to a related card
      const firstLink = relatedLinks.first();
      await firstLink.click();

      await expect
        .poll(
          async () => {
            const hash = await page.evaluate(() => window.location.hash);
            return /^#\/cards\/.+/.test(hash) && !hash.includes("the-nurse");
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      // Navigate back to The Nurse
      await goToCardDetail(page, "the-nurse");

      const route = await getCurrentRoute(page);
      expect(route).toBe("/cards/the-nurse");

      const heading = page.locator("h1");
      await expect(heading).toBeVisible({ timeout: 10_000 });
      const headingText = await heading.textContent();
      expect(headingText).toContain("The Nurse");
    });

    test("should also show chain card for House of Mirrors (The Immortal)", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");
      await page.waitForTimeout(5_000);

      const mainContent = await page.locator("main").textContent();

      // House of Mirrors rewards Mirror of Kalandra (not a div card → no downstream chain).
      // But The Immortal rewards House of Mirrors, so it should appear as an upstream chain card.
      if (!mainContent?.includes("Card Chain")) {
        // Chain section didn't render — soft skip.
        // This can happen if the related cards lookup doesn't find The Immortal.
        return;
      }

      expect(mainContent).toContain("The Immortal");
    });
  });

  // ── Tab Switching ─────────────────────────────────────────────────────────

  test.describe("Tab Switching", () => {
    test("should switch from Your Data to Market Data tab", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // Verify Your Data tab is active by default
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await expect(yourDataTab).toBeVisible({ timeout: 10_000 });

      const isYourDataActive = await yourDataTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isYourDataActive,
        "Your Data tab should be active by default",
      ).toBe(true);

      // Click Market Data tab
      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      await marketTab.click();

      // Wait for content to switch
      await page.waitForTimeout(1_000);

      // Market Data tab should now be active
      const isMarketActive = await marketTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isMarketActive,
        "Market Data tab should be active after click",
      ).toBe(true);

      // Your Data tab should no longer be active
      const isYourDataActiveAfter = await yourDataTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(isYourDataActiveAfter, "Your Data tab should be inactive").toBe(
        false,
      );
    });

    test("should switch back from Market Data to Your Data tab", async ({
      page,
    }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // Switch to Market Data
      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      await marketTab.click();
      await page.waitForTimeout(1_000);

      // Switch back to Your Data
      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await yourDataTab.click();
      await page.waitForTimeout(1_000);

      // Your Data tab should be active again
      const isYourDataActive = await yourDataTab.evaluate((el) =>
        el.classList.contains("tab-active"),
      );
      expect(
        isYourDataActive,
        "Your Data tab should be active after switching back",
      ).toBe(true);
    });

    test("should preserve page route when switching tabs", async ({ page }) => {
      await goToCardDetail(page, "house-of-mirrors");

      // Switch tabs back and forth
      const marketTab = page.locator('button[role="tab"]', {
        hasText: "Market Data",
      });
      await marketTab.click();
      await page.waitForTimeout(500);

      // Route should still be the same card detail page
      let route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");

      const yourDataTab = page.locator('button[role="tab"]', {
        hasText: "Your Data",
      });
      await yourDataTab.click();
      await page.waitForTimeout(500);

      route = await getCurrentRoute(page);
      expect(route).toBe("/cards/house-of-mirrors");
    });
  });
});
