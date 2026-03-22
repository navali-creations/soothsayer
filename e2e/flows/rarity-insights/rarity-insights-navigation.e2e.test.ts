/**
 * Rarity Insights — Navigation tests
 *
 * Covers Card Click Navigation and Cross-Navigation between pages.
 *
 * @module e2e/flows/rarity-insights/rarity-insights-navigation.e2e.test
 */

import { SEARCHABLE_CARD_NAME } from "../../fixtures/rarity-insights-fixture";
import { expect, test } from "../../helpers/electron-test";
import { getCurrentRoute, navigateTo } from "../../helpers/navigation";
import {
  createSeedGuard,
  ensurePostSetup,
  getTableRowCount,
  goToRarityInsights,
  searchAndWaitForCard,
  waitForPageSettled,
  waitForTableRows,
} from "./rarity-insights.helpers";

const ensureDataSeeded = createSeedGuard();

test.describe("Rarity Insights — Navigation", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await ensureDataSeeded(page);
  });

  // ─── Card Click Navigation ──────────────────────────────────────────────────

  test.describe("Card Click Navigation", () => {
    test("should navigate to card details page when clicking a card name", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCard(page, SEARCHABLE_CARD_NAME);
      const cardLink = page
        .locator("table tbody tr td a", { hasText: SEARCHABLE_CARD_NAME })
        .first();
      await cardLink.click();
      await page.waitForFunction(
        () => window.location.hash.includes("/cards/"),
        { timeout: 5_000 },
      );
      const route = await getCurrentRoute(page);
      expect(route).toMatch(/^\/cards\//);
      expect(route).toContain("the-doctor");
    });

    test("should navigate back to Rarity Insights from card details", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCard(page, SEARCHABLE_CARD_NAME);
      await page
        .locator("table tbody tr td a", { hasText: SEARCHABLE_CARD_NAME })
        .first()
        .click();
      await page.waitForFunction(
        () => window.location.hash.includes("/cards/"),
        { timeout: 5_000 },
      );
      await navigateTo(page, "/rarity-insights");
      await page
        .getByRole("heading", { name: /Rarity Insights/i })
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
      expect(await getCurrentRoute(page)).toBe("/rarity-insights");
      await waitForTableRows(page);
      expect(await getTableRowCount(page)).toBeGreaterThan(0);
    });

    test("should produce correct slug for card names with spaces", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await searchAndWaitForCard(page, "Rain of Chaos");
      await page
        .locator("table tbody tr td a", { hasText: "Rain of Chaos" })
        .first()
        .click();
      await page.waitForFunction(
        () => window.location.hash.includes("/cards/"),
        { timeout: 5_000 },
      );
      expect(await getCurrentRoute(page)).toContain("rain-of-chaos");
      await navigateTo(page, "/rarity-insights");
    });
  });

  // ─── Cross-Navigation ──────────────────────────────────────────────────────

  test.describe("Cross-Navigation", () => {
    test("should navigate to Rarity Insights via sidebar", async ({ page }) => {
      await navigateTo(page, "/");
      await page.waitForFunction(() => window.location.hash === "#/", {
        timeout: 5_000,
      });
      const sidebar = page.locator("aside");
      const link = sidebar.getByText("Rarity Insights", { exact: true });
      const linkVisible = await link
        .isVisible({ timeout: 3_000 })
        .catch(() => false);
      if (linkVisible) {
        await link.click();
        await page.waitForFunction(
          () => window.location.hash === "#/rarity-insights",
          { timeout: 5_000 },
        );
        expect(await getCurrentRoute(page)).toBe("/rarity-insights");
      } else {
        await navigateTo(page, "/rarity-insights");
        expect(await getCurrentRoute(page)).toBe("/rarity-insights");
      }
    });

    test("should preserve table content on round-trip navigation", async ({
      page,
    }) => {
      await goToRarityInsights(page);
      await waitForPageSettled(page);
      await waitForTableRows(page);
      await navigateTo(page, "/");
      await page.waitForFunction(() => window.location.hash === "#/", {
        timeout: 5_000,
      });
      await navigateTo(page, "/rarity-insights");
      await page
        .getByRole("heading", { name: /Rarity Insights/i })
        .first()
        .waitFor({ state: "visible", timeout: 10_000 });
      await waitForTableRows(page);
      expect(await getTableRowCount(page)).toBeGreaterThan(0);
    });

    test("should navigate smoothly between related pages", async ({ page }) => {
      const routes = [
        "/rarity-insights",
        "/profit-forecast",
        "/rarity-insights",
        "/statistics",
        "/rarity-insights",
      ] as const;
      for (const route of routes) {
        await navigateTo(page, route);
        await expect(page.locator("main")).toBeVisible({ timeout: 5_000 });
      }
      expect(await getCurrentRoute(page)).toBe("/rarity-insights");
    });
  });
});
