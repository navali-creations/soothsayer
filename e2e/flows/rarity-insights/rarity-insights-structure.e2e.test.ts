/**
 * Rarity Insights — Structure & Table tests
 *
 * Covers page structure verification, table behavior (pagination, search,
 * column headers, rarity badges), R1–R4 header chip sorting, and the
 * ComparisonToolbar rendering.
 *
 * @module e2e/flows/rarity-insights/rarity-insights-structure.e2e.test
 */

import {
  LOW_CONFIDENCE_CARD,
  NON_BOSS_CARDS,
  PL_ABSENT_CARD,
  RARITY_LABELS,
  SEARCHABLE_CARD_NAME,
} from "../../fixtures/rarity-insights-fixture";
import { expect, test } from "../../helpers/electron-test";
import { getCurrentRoute } from "../../helpers/navigation";
import {
  clearSearchAndWaitForTable,
  clickChipAndWaitForReorder,
  createSeedGuard,
  disableBossCards,
  enableBossCards,
  ensurePostSetup,
  getTableRowCount,
  getVisibleCardNames,
  goToRarityInsights,
  searchAndWaitForCard,
  waitForPageSettled,
  waitForTableRows,
} from "./rarity-insights.helpers";

const ensureDataSeeded = createSeedGuard();

test.describe("Rarity Insights — Structure", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ─── Page Structure ───────────────────────────────────────────────────────

  test.describe("Page Structure", () => {
    test("should render the page heading, subtitle, warning, and Cards card", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await expect(
        page.getByRole("heading", { name: /Rarity Insights/i }).first(),
      ).toBeVisible();
      await expect(
        page.getByText("Compare and edit divination card rarities").first(),
      ).toBeVisible();
      const route = await getCurrentRoute(page);
      expect(route).toBe("/rarity-insights");
      await expect(page.locator("aside")).toBeVisible();
      await expect(page.locator("main")).toBeVisible();
      await expect(
        page
          .getByText(
            /changing a card.*rarity here does not modify the filter files/i,
          )
          .first(),
      ).toBeVisible();
      await waitForPageSettled(page);
      await expect(
        page.locator(".card-title", { hasText: "Cards" }).first(),
      ).toBeVisible();
    });
  });

  // ─── Table Behavior ───────────────────────────────────────────────────────

  test.describe("Table Behavior", () => {
    test("should render a paginated table with 20 rows from the full catalog", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      const rowCount = await getTableRowCount(page);
      expect(rowCount).toBe(20);
    });

    test("should find fixtured cards via search", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      for (const name of [SEARCHABLE_CARD_NAME, "Humility", "Carrion Crow"]) {
        await searchAndWaitForCard(page, name);
        const visibleNames = await getVisibleCardNames(page);
        expect(visibleNames).toContain(name);
      }
      await clearSearchAndWaitForTable(page);
    });

    test("should show column headers with R1-R4 chips", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await expect(
        page.locator("table thead th", { hasText: "Card Name" }),
      ).toBeVisible();
      const poeNinjaHeader = page.locator(
        '[data-onboarding="rarity-insights-poe-ninja"]',
      );
      await expect(poeNinjaHeader).toBeVisible();
      await expect(
        poeNinjaHeader.locator("span", { hasText: "poe.ninja" }),
      ).toBeVisible();
      await expect(poeNinjaHeader.locator("button.badge")).toHaveCount(4);
      const plHeader = page.locator(
        '[data-onboarding="rarity-insights-prohibited-library"]',
      );
      await expect(plHeader).toBeVisible();
      await expect(
        plHeader.locator("span", { hasText: "Prohibited Library" }),
      ).toBeVisible();
      await expect(plHeader.locator("button.badge")).toHaveCount(4);
    });

    test("should display correct rarity badge for a known card", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCard(page, "Humility");
      const humilityRow = page.locator("table tbody tr", {
        hasText: "Humility",
      });
      await expect(
        humilityRow
          .locator("span.badge", { hasText: RARITY_LABELS[4] })
          .first(),
      ).toBeVisible();
      await clearSearchAndWaitForTable(page);
    });

    test("should show Unknown badge for low-confidence card", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCard(page, LOW_CONFIDENCE_CARD.name);
      const row = page.locator("table tbody tr", {
        hasText: LOW_CONFIDENCE_CARD.name,
      });
      await expect(
        row.locator("span.badge", { hasText: "Unknown" }).first(),
      ).toBeVisible();
      await clearSearchAndWaitForTable(page);
    });

    test("should show dash for card absent from Prohibited Library", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await enableBossCards(page);
      await searchAndWaitForCard(page, PL_ABSENT_CARD.name);
      const row = page.locator("table tbody tr", {
        hasText: PL_ABSENT_CARD.name,
      });
      await expect(row.locator("text=—").first()).toBeVisible();
      await clearSearchAndWaitForTable(page);
      await disableBossCards(page);
    });

    test("should display placeholder filter columns and pagination", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      const placeholders = page.locator("table thead th span", {
        hasText: /^Filter \d$/,
      });
      await expect(placeholders.first()).toBeVisible({ timeout: 5_000 });
      await expect(
        page.locator("text=/Showing \\d+ to \\d+ of/"),
      ).toBeVisible();
    });
  });

  // ─── R1–R4 Header Chips ───────────────────────────────────────────────────

  test.describe("R1–R4 Header Chips", () => {
    test("should reorder table when clicking poe.ninja R1 chip", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-poe-ninja"]',
        0,
      );
      const sortedNames = await getVisibleCardNames(page);
      const fixtureR1Names = NON_BOSS_CARDS.filter(
        (c) => c.poeNinjaRarity === 1,
      ).map((c) => c.name);
      expect(fixtureR1Names.some((n) => sortedNames.includes(n))).toBe(true);
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-poe-ninja"]',
        0,
      );
    });

    test("should reorder table when clicking PL R4 chip", async ({ page }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-prohibited-library"]',
        3,
      );
      const sortedNames = await getVisibleCardNames(page);
      const fixtureR4PlNames = NON_BOSS_CARDS.filter(
        (c) => c.plRarity === 4,
      ).map((c) => c.name);
      expect(fixtureR4PlNames.some((n) => sortedNames.includes(n))).toBe(true);
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-prohibited-library"]',
        3,
      );
    });

    test("should deactivate poe.ninja chip when clicking a PL chip", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-poe-ninja"]',
        1,
      );
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-prohibited-library"]',
        2,
      );
      const names = await getVisibleCardNames(page);
      expect(names.length).toBeGreaterThan(0);
      await clickChipAndWaitForReorder(
        page,
        '[data-onboarding="rarity-insights-prohibited-library"]',
        2,
      );
    });
  });

  // ─── ComparisonToolbar ────────────────────────────────────────────────────

  test.describe("ComparisonToolbar", () => {
    test("should render the toolbar with both checkboxes and correct subtitle", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      const toolbar = page.locator(
        '[data-onboarding="rarity-insights-toolbar"]',
      );
      await expect(toolbar).toBeVisible();
      await expect(
        toolbar
          .locator("label", { hasText: "Include boss cards" })
          .locator("input[type='checkbox']"),
      ).toBeVisible();
      await expect(
        toolbar
          .locator("label", { hasText: "Show differences only" })
          .locator("input[type='checkbox']"),
      ).toBeVisible();
      await expect(
        page
          .getByText(
            /Select filters to compare rarities against other rarity sources/,
          )
          .first(),
      ).toBeVisible();
    });
  });
});
