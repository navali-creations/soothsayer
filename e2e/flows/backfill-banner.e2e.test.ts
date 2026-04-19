/**
 * E2E Test: BackfillBanner
 *
 * Tests the BackfillBanner component which appears in the AppMenu area when
 * there are leagues eligible for community data backfill.
 *
 * The banner's visibility is controlled by two Zustand slices:
 *   - `communityUpload.backfillLeagues`: non-empty array → banner visible
 *   - `communityUpload.backfillLeagues`: empty array → banner hidden
 *   - `banners.isDismissed("community-backfill")`: true → banner hidden permanently
 *
 * Dismissal is now **persistent** — clicking "Dismiss" writes to the
 * `dismissed_banners` SQLite table via the `banners` IPC module, so the
 * banner never reappears even after app restart.
 *
 * These tests manipulate the store directly via `window.__zustandStore`
 * (exposed only in E2E mode) to verify rendering behaviour without
 * needing real IPC round-trips.
 *
 * Note: The "Contribute" button's `triggerBackfill` action is tested
 * thoroughly in unit tests (BackfillBanner.test.tsx). E2E tests here
 * focus on visibility, content, loading states, and dismiss persistence
 * — things that benefit from a real Electron environment.
 *
 * @module e2e/flows/backfill-banner
 */

import { expect, test } from "../helpers/electron-test";
import { ensurePostSetup } from "../helpers/navigation";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Injects backfill leagues into the Zustand store so the banner becomes visible.
 * Also ensures the banners slice does NOT have "community-backfill" dismissed.
 */
async function injectBackfillLeagues(
  page: import("@playwright/test").Page,
  leagues: { game: string; league: string }[] = [
    { game: "poe1", league: "Settlers" },
  ],
) {
  await page.evaluate((leagues) => {
    const store = (window as any).__zustandStore;
    if (!store) throw new Error("__zustandStore not available");
    store.setState((s: any) => {
      s.communityUpload.backfillLeagues = leagues;
      s.communityUpload.isBackfilling = false;
      // Ensure the banner is not dismissed in the banners slice
      const ids = new Set(s.banners.dismissedIds);
      ids.delete("community-backfill");
      s.banners.dismissedIds = ids;
      s.banners.isLoaded = true;
    });
  }, leagues);
}

/**
 * Clears backfill leagues so the banner is hidden.
 */
async function clearBackfillLeagues(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const store = (window as any).__zustandStore;
    if (!store) throw new Error("__zustandStore not available");
    store.setState((s: any) => {
      s.communityUpload.backfillLeagues = [];
      s.communityUpload.isBackfilling = false;
    });
  });
}

/**
 * Marks the "community-backfill" banner as permanently dismissed in the
 * banners slice (simulating the DB-persisted dismissal).
 */
async function dismissBannerInStore(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const store = (window as any).__zustandStore;
    if (!store) throw new Error("__zustandStore not available");
    store.setState((s: any) => {
      s.banners.dismissedIds = new Set([
        ...s.banners.dismissedIds,
        "community-backfill",
      ]);
    });
  });
}

/**
 * Sets the isBackfilling flag to simulate an in-progress upload.
 */
async function setBackfillingState(
  page: import("@playwright/test").Page,
  isBackfilling: boolean,
) {
  await page.evaluate((val) => {
    const store = (window as any).__zustandStore;
    if (!store) throw new Error("__zustandStore not available");
    store.setState((s: any) => {
      s.communityUpload.isBackfilling = val;
    });
  }, isBackfilling);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

test.describe("BackfillBanner", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    // Start each test with a clean backfill state
    await clearBackfillLeagues(page);
  });

  // ── Visibility ────────────────────────────────────────────────────────

  test.describe("Visibility", () => {
    test("should not render when backfillLeagues is empty", async ({
      page,
    }) => {
      await clearBackfillLeagues(page);

      // The banner contains "wraeclast.cards" text — it should not be present
      const banner = page.getByText("wraeclast.cards");
      await expect(banner).not.toBeVisible({ timeout: 3_000 });
    });

    test("should render when backfillLeagues has entries", async ({ page }) => {
      await injectBackfillLeagues(page);

      const bannerText = page.getByText("existing and future drop data");
      await expect(bannerText).toBeVisible({ timeout: 5_000 });
    });

    test("should render the wraeclast.cards external link", async ({
      page,
    }) => {
      await injectBackfillLeagues(page);

      const link = page.locator('a[href="https://wraeclast.cards"]');
      await expect(link).toBeVisible({ timeout: 5_000 });
      await expect(link).toHaveAttribute("target", "_blank");
    });

    test("should render the Privacy Policy in-app link", async ({ page }) => {
      await injectBackfillLeagues(page);

      const privacyLink = page.getByText("Privacy Policy");
      await expect(privacyLink).toBeVisible({ timeout: 5_000 });
    });

    test("should not render when banner is permanently dismissed", async ({
      page,
    }) => {
      await injectBackfillLeagues(page);
      // Verify it's visible first
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      // Simulate persistent dismissal via banners slice
      await dismissBannerInStore(page);

      await expect(
        page.getByText("existing and future drop data"),
      ).not.toBeVisible({ timeout: 5_000 });
    });

    test("should disappear when backfillLeagues becomes empty", async ({
      page,
    }) => {
      await injectBackfillLeagues(page);
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      await clearBackfillLeagues(page);

      await expect(
        page.getByText("existing and future drop data"),
      ).not.toBeVisible({ timeout: 5_000 });
    });

    test("should render for poe2 leagues as well", async ({ page }) => {
      await injectBackfillLeagues(page, [{ game: "poe2", league: "Dawn" }]);

      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );
    });
  });

  // ── Banner Content ────────────────────────────────────────────────────

  test.describe("Content", () => {
    test.beforeEach(async ({ page }) => {
      await injectBackfillLeagues(page);
      // Wait for the banner to appear
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );
    });

    test("should render the Contribute button", async ({ page }) => {
      const contributeBtn = page.getByRole("button", { name: "Contribute" });
      await expect(contributeBtn).toBeVisible({ timeout: 5_000 });
    });

    test("should render a dismiss button", async ({ page }) => {
      const dismissBtn = page.getByRole("button", { name: "Dismiss" });
      await expect(dismissBtn).toBeVisible({ timeout: 5_000 });
    });

    test("should render an opt-in checkbox", async ({ page }) => {
      const checkbox = page.getByRole("checkbox");
      await expect(checkbox).toBeVisible({ timeout: 5_000 });
      // Should be unchecked by default
      await expect(checkbox).not.toBeChecked();
    });

    test("Contribute button should be disabled when checkbox is unchecked", async ({
      page,
    }) => {
      const contributeBtn = page.getByRole("button", { name: "Contribute" });
      await expect(contributeBtn).toBeDisabled();
    });

    test("Contribute button should be enabled after checking the opt-in checkbox", async ({
      page,
    }) => {
      const checkbox = page.getByRole("checkbox");
      await checkbox.click();

      const contributeBtn = page.getByRole("button", { name: "Contribute" });
      await expect(contributeBtn).toBeEnabled({ timeout: 3_000 });
    });
  });

  // ── Loading State ─────────────────────────────────────────────────────

  test.describe("Loading State", () => {
    test("should show Uploading… text when isBackfilling is true", async ({
      page,
    }) => {
      await injectBackfillLeagues(page);
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      await setBackfillingState(page, true);

      await expect(page.getByText("Uploading…")).toBeVisible({
        timeout: 5_000,
      });
      // Contribute button should not be visible during upload
      await expect(
        page.getByRole("button", { name: "Contribute" }),
      ).not.toBeVisible({
        timeout: 3_000,
      });
    });

    test("should disable checkbox during backfill", async ({ page }) => {
      await injectBackfillLeagues(page);
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      await setBackfillingState(page, true);

      const checkbox = page.getByRole("checkbox");
      await expect(checkbox).toBeDisabled({ timeout: 3_000 });
    });

    test("should disable dismiss button during backfill", async ({ page }) => {
      await injectBackfillLeagues(page);
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      await setBackfillingState(page, true);

      const dismissBtn = page.getByRole("button", { name: "Dismiss" });
      await expect(dismissBtn).toBeDisabled({ timeout: 3_000 });
    });
  });

  // ── Dismiss Interaction ───────────────────────────────────────────────

  test.describe("Dismiss", () => {
    test("clicking dismiss should hide the banner and persist dismissal", async ({
      page,
    }) => {
      await injectBackfillLeagues(page);
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      // The dismiss button should show "Dismiss" text (not just an X icon)
      const dismissBtn = page.getByRole("button", { name: "Dismiss" });
      await expect(dismissBtn).toHaveText("Dismiss");
      await dismissBtn.click();

      await expect(
        page.getByText("existing and future drop data"),
      ).not.toBeVisible({ timeout: 5_000 });

      // Verify the banners slice was updated (persistent dismissal)
      const bannerDismissed = await page.evaluate(() => {
        const store = (window as any).__zustandStore;
        const ids = store?.getState()?.banners?.dismissedIds;
        // dismissedIds is a Set — check membership
        return ids instanceof Set ? ids.has("community-backfill") : false;
      });
      expect(bannerDismissed).toBe(true);
    });

    test("banner should stay hidden after re-injecting leagues when permanently dismissed", async ({
      page,
    }) => {
      // First dismiss the banner
      await injectBackfillLeagues(page);
      await expect(page.getByText("existing and future drop data")).toBeVisible(
        { timeout: 5_000 },
      );

      const dismissBtn = page.getByRole("button", { name: "Dismiss" });
      await dismissBtn.click();

      await expect(
        page.getByText("existing and future drop data"),
      ).not.toBeVisible({ timeout: 5_000 });

      // Now inject new leagues — banner should NOT reappear because it's
      // permanently dismissed in the banners slice
      await page.evaluate(() => {
        const store = (window as any).__zustandStore;
        if (!store) throw new Error("__zustandStore not available");
        store.setState((s: any) => {
          s.communityUpload.backfillLeagues = [
            { game: "poe2", league: "Dawn" },
          ];
        });
      });

      // Give React a tick to re-render
      await page.waitForTimeout(500);

      await expect(
        page.getByText("existing and future drop data"),
      ).not.toBeVisible({ timeout: 3_000 });
    });
  });
});
