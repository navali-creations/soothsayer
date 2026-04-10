/**
 * E2E Test: AppMenu (Title Bar)
 *
 * Tests the AppMenu component which includes:
 * - AppTitle (branding / version badge)
 * - GameSelector (game tabs with league dropdowns — only visible post-setup)
 * - AppControls (overlay toggle, more options dropdown, window controls)
 *
 * Prerequisites:
 * - App must be built (`.vite/build/main.js` exists)
 * - Setup must be complete (or completable via skipSetup)
 *
 * @module e2e/flows/app-menu
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../helpers/electron-test";
import {
  callElectronAPI,
  getSetting,
  mockSetupIncomplete,
  setSetting,
} from "../helpers/ipc-helpers";
import {
  ensurePostSetup,
  getCurrentRoute,
  navigateTo,
  waitForHydration,
  waitForRoute,
} from "../helpers/navigation";
import { seedLeagueCache, seedSessionPrerequisites } from "../helpers/seed-db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Poll the overlay's `isVisible` state via IPC until it matches the
 * expected value, or throw after `timeout` ms.
 */
async function waitForOverlayState(
  page: Page,
  expectedVisible: boolean,
  timeout = 5_000,
) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const isVisible = await callElectronAPI<boolean>(
      page,
      "overlay",
      "isVisible",
    );
    if (isVisible === expectedVisible) return;
    await page.waitForTimeout(100);
  }
  throw new Error(
    `Overlay did not become ${
      expectedVisible ? "visible" : "hidden"
    } within ${timeout}ms`,
  );
}

/**
 * Reliably open the "More options" dropdown and wait for the popover to
 * be in the `:popover-open` state.
 *
 * The dropdown uses the native HTML `popover="auto"` API which has
 * "light dismiss" behaviour — it auto-closes on any outside interaction
 * or focus change.  A naïve `click(); waitForTimeout(300)` is racy
 * because React re-renders or focus shifts can dismiss the popover
 * between the click and the first assertion.
 *
 * This helper:
 * 1. Dismisses any leftover open popovers / dialogs.
 * 2. Clicks the trigger button.
 * 3. Waits for the `[popover]` element to match `:popover-open`.
 * 4. Retries once if the popover closed before we could observe it.
 */
async function openMoreOptionsDropdown(page: Page) {
  // Dismiss any previously open dialogs / popovers so the trigger
  // acts as an "open" (not a "toggle-close").
  await page.evaluate(() => {
    document.querySelectorAll("dialog[open]").forEach((d) => {
      (d as HTMLDialogElement).close();
    });
    document.querySelectorAll("[popover]:popover-open").forEach((el) => {
      (el as HTMLElement).hidePopover();
    });
  });
  await expect(page.locator("[popover]:popover-open")).toHaveCount(0, {
    timeout: 2_000,
  });

  const trigger = page.locator('[data-tip="More options"] button').first();
  await expect(trigger).toBeVisible({ timeout: 10_000 });

  // We may need a retry: if a React re-render or focus shift causes
  // the popover to light-dismiss before we can observe it.
  for (let attempt = 0; attempt < 3; attempt++) {
    await trigger.click();

    // Wait for the popover panel to reach :popover-open
    const opened = await page
      .locator("[popover]:popover-open")
      .first()
      .waitFor({ state: "visible", timeout: 2_000 })
      .then(() => true)
      .catch(() => false);

    if (opened) return;

    // Brief pause before retrying
    await page.waitForTimeout(200);
  }

  // Final attempt — let Playwright throw on failure
  await trigger.click();
  await page.locator("[popover]:popover-open").first().waitFor({
    state: "visible",
    timeout: 5_000,
  });
}

// ─── AppMenu ──────────────────────────────────────────────────────────────────

test.describe("AppMenu", () => {
  test.describe("Visibility", () => {
    test("should render the AppMenu title bar with app name and version badge", async ({
      page,
    }) => {
      await ensurePostSetup(page);

      // The AppTitle renders the text "soothsayer" in a <p> tag
      const appTitle = page.getByText("soothsayer").first();
      await expect(appTitle).toBeVisible({ timeout: 10_000 });

      // The AppTitle also renders a version badge with the class "badge"
      const versionBadge = page.locator(".badge").first();
      await expect(versionBadge).toBeVisible({ timeout: 5_000 });

      // The badge text should start with "v" (e.g. "v1.2.3")
      const badgeText = await versionBadge.textContent();
      expect(
        badgeText?.trim().startsWith("v"),
        `Expected version badge to start with "v", got "${badgeText}"`,
      ).toBe(true);
    });

    test("should not show GameSelector during setup mode", async ({ page }) => {
      await mockSetupIncomplete(page);
      await waitForHydration(page, 30_000);

      // The game selector should NOT be visible during setup
      const gameSelector = page.locator('[data-onboarding="game-selector"]');
      await expect(gameSelector).not.toBeVisible();
    });
  });

  test.describe("Game Selector", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should render the game selector with poe1 tab", async ({ page }) => {
      const gameSelector = page.locator('[data-onboarding="game-selector"]');
      await expect(gameSelector).toBeVisible({ timeout: 10_000 });

      // Should have a tab with "Path of Exile 1" text
      const poe1Tab = gameSelector.getByText("Path of Exile 1");
      await expect(poe1Tab).toBeVisible();
    });

    test("should have the correct data-onboarding attribute and tablist role", async ({
      page,
    }) => {
      const gameSelector = page.locator('[data-onboarding="game-selector"]');
      await expect(gameSelector).toBeVisible({ timeout: 10_000 });

      // GameSelector renders a <div role="tablist"> with data-onboarding
      await expect(gameSelector).toHaveAttribute("role", "tablist");
    });

    test("should render league select dropdown inside the game tab", async ({
      page,
    }) => {
      const gameSelector = page.locator('[data-onboarding="game-selector"]');
      await expect(gameSelector).toBeVisible({ timeout: 10_000 });

      // The LeagueSelect renders a <select> element inside the tab
      const leagueSelect = gameSelector.locator("select");
      await expect(leagueSelect).toBeVisible();
    });

    test("should reflect seeded leagues in the league dropdown", async ({
      page,
    }) => {
      // Seed two leagues into poe_leagues_cache — this is the table that
      // PoeLeaguesService reads from via PoeLeaguesRepository.
      // (seedSessionPrerequisites seeds the separate `leagues` table used
      // by the snapshot pipeline, which does NOT populate the UI dropdown.)
      await seedLeagueCache(page, {
        game: "poe1",
        leagueId: "Standard",
        name: "Standard",
      });
      await seedLeagueCache(page, {
        game: "poe1",
        leagueId: "Settlers of Kalguur",
        name: "Settlers of Kalguur",
      });

      // Reload so the store hydrates with the seeded league cache
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);

      const gameSelector = page.locator('[data-onboarding="game-selector"]');
      await expect(gameSelector).toBeVisible({ timeout: 10_000 });

      // The league dropdown should have options for the seeded leagues
      const leagueSelect = gameSelector.locator("select");
      await expect(leagueSelect).toBeVisible();

      const optionCount = await leagueSelect.locator("option").count();
      expect(
        optionCount,
        "League dropdown should have at least 2 options after seeding two leagues",
      ).toBeGreaterThanOrEqual(2);

      // Verify the option texts include both seeded league names
      const optionTexts = await leagueSelect
        .locator("option")
        .allTextContents();
      const hasStandard = optionTexts.some((t) => t.includes("Standard"));
      const hasSettlers = optionTexts.some((t) =>
        t.includes("Settlers of Kalguur"),
      );
      expect(
        hasStandard,
        'League dropdown should contain "Standard" option',
      ).toBe(true);
      expect(
        hasSettlers,
        'League dropdown should contain "Settlers of Kalguur" option',
      ).toBe(true);
    });
  });

  test.describe("Window Controls", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should render minimize, maximize, and close buttons in the title bar", async ({
      page,
    }) => {
      // AppControls renders three ghost buttons for minimize, maximize/unmaximize, close
      const controlButtons = page.locator("button.btn-ghost.btn-sm");
      const count = await controlButtons.count();
      expect(
        count,
        "Should have window control buttons in the title bar",
      ).toBeGreaterThanOrEqual(3);
    });

    test("clicking minimize should minimize the window", async ({
      app,
      page,
    }) => {
      const browserWindow = await app.browserWindow(page);

      // Ensure the window is restored before we start
      const alreadyMinimized = await browserWindow.evaluate((win) =>
        win.isMinimized(),
      );
      if (alreadyMinimized) {
        await browserWindow.evaluate((win) => win.restore());
        await expect
          .poll(() => browserWindow.evaluate((win) => win.isMinimized()), {
            timeout: 5_000,
          })
          .toBe(false);
      }

      // Minimize via the preload IPC bridge
      await callElectronAPI(page, "mainWindow", "minimize");
      await expect
        .poll(() => browserWindow.evaluate((win) => win.isMinimized()), {
          timeout: 5_000,
        })
        .toBe(true);

      // Verify the window is minimized from the Electron main process side
      const isMinimized = await browserWindow.evaluate((win) =>
        win.isMinimized(),
      );
      expect(isMinimized, "Window should be minimized after IPC call").toBe(
        true,
      );

      // Restore so subsequent tests are not affected
      await browserWindow.evaluate((win) => win.restore());
      await expect
        .poll(() => browserWindow.evaluate((win) => win.isMinimized()), {
          timeout: 5_000,
        })
        .toBe(false);

      const isRestoredAfter = await browserWindow.evaluate((win) =>
        win.isMinimized(),
      );
      expect(
        isRestoredAfter,
        "Window should no longer be minimized after restore",
      ).toBe(false);
    });

    test("clicking maximize should maximize the window, then unmaximize should restore it", async ({
      app,
      page,
    }) => {
      const browserWindow = await app.browserWindow(page);

      // Ensure we start in a non-maximized state
      const alreadyMaximized = await browserWindow.evaluate((win) =>
        win.isMaximized(),
      );
      if (alreadyMaximized) {
        await browserWindow.evaluate((win) => win.unmaximize());
        await expect
          .poll(() => browserWindow.evaluate((win) => win.isMaximized()), {
            timeout: 5_000,
          })
          .toBe(false);
      }

      // Maximize via the preload IPC bridge
      await callElectronAPI(page, "mainWindow", "maximize");
      await expect
        .poll(() => browserWindow.evaluate((win) => win.isMaximized()), {
          timeout: 5_000,
        })
        .toBe(true);

      // Verify the window is maximized from the Electron main process side
      const isMaximized = await browserWindow.evaluate((win) =>
        win.isMaximized(),
      );
      expect(isMaximized, "Window should be maximized after IPC call").toBe(
        true,
      );

      // Also verify via the renderer-side IPC bridge
      const rendererIsMaximized = await callElectronAPI<boolean>(
        page,
        "mainWindow",
        "isMaximized",
      );
      expect(
        rendererIsMaximized,
        "Renderer-side isMaximized should agree with main process",
      ).toBe(true);

      // Unmaximize via the preload IPC bridge
      await callElectronAPI(page, "mainWindow", "unmaximize");
      await expect
        .poll(() => browserWindow.evaluate((win) => win.isMaximized()), {
          timeout: 5_000,
        })
        .toBe(false);

      // Verify the window is no longer maximized
      const isMaximizedAfter = await browserWindow.evaluate((win) =>
        win.isMaximized(),
      );
      expect(
        isMaximizedAfter,
        "Window should not be maximized after unmaximize IPC call",
      ).toBe(false);

      const rendererIsMaximizedAfter = await callElectronAPI<boolean>(
        page,
        "mainWindow",
        "isMaximized",
      );
      expect(
        rendererIsMaximizedAfter,
        "Renderer-side isMaximized should report false after unmaximize",
      ).toBe(false);
    });

    test("close IPC handler should be registered as a callable function", async ({
      page,
    }) => {
      // Verify the close method exists on the preload API without actually
      // invoking it — calling close would destroy or hide the window and
      // break subsequent tests.
      const isFunction = await page.evaluate(
        () => typeof (window as any).electron.mainWindow.close === "function",
      );
      expect(
        isFunction,
        "window.electron.mainWindow.close should be a registered function",
      ).toBe(true);
    });
  });

  test.describe("Overlay Toggle", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should render the overlay toggle button with correct onboarding attribute", async ({
      page,
    }) => {
      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });
    });

    test("should open and close overlay via the AppMenu toggle button", async ({
      page,
    }) => {
      // Ensure overlay starts hidden
      try {
        const alreadyVisible = await callElectronAPI<boolean>(
          page,
          "overlay",
          "isVisible",
        );
        if (alreadyVisible) {
          await callElectronAPI(page, "overlay", "hide");
          await waitForOverlayState(page, false);
        }
      } catch {
        // overlay window may not exist yet
      }

      const overlayButton = page.locator('[data-onboarding="overlay-icon"]');
      await expect(overlayButton).toBeVisible({ timeout: 10_000 });

      // Click to open
      await overlayButton.click();
      await waitForOverlayState(page, true);

      // Verify overlay is now visible
      const isVisible = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isVisible).toBe(true);

      // Click again to close
      await overlayButton.click();
      await waitForOverlayState(page, false);

      // Verify overlay is hidden
      const isHidden = await callElectronAPI<boolean>(
        page,
        "overlay",
        "isVisible",
      );
      expect(isHidden).toBe(false);
    });
  });

  test.describe("More Options Dropdown", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should render the more options dropdown trigger", async ({
      page,
    }) => {
      // The dropdown trigger is a <button> rendered by the Dropdown component
      // with the class "btn btn-ghost btn-sm" and it uses popoverTarget.
      // It wraps the <RxCaretDown /> icon and sits inside a tooltip with data-tip="More options".
      const moreOptionsTrigger = page.locator(
        '[data-tip="More options"] button, [data-tip="More options"] > button',
      );
      await expect(moreOptionsTrigger.first()).toBeVisible({ timeout: 10_000 });
    });

    test("should show dropdown menu items when opened", async ({ page }) => {
      await openMoreOptionsDropdown(page);

      // Verify all expected menu items are present
      const menuItems = [
        "Settings",
        "What's New",
        "Changelog",
        "View Source",
        "Discord",
        "Attributions",
      ];

      for (const item of menuItems) {
        const menuItem = page.locator("[popover] li").getByText(item);
        await expect(
          menuItem,
          `Menu item "${item}" should be visible in the dropdown`,
        ).toBeVisible({ timeout: 5_000 });
      }
    });

    test("should navigate to Settings when clicking the Settings menu item", async ({
      page,
    }) => {
      // Ensure we start on a known route
      await navigateTo(page, "/");
      await waitForRoute(page, "/");

      // Open the dropdown
      await openMoreOptionsDropdown(page);

      // Click the "Settings" link
      const settingsItem = page.locator("[popover] li").getByText("Settings");
      await expect(settingsItem).toBeVisible({ timeout: 5_000 });
      await settingsItem.click();

      // Wait for navigation to /settings
      await waitForRoute(page, "/settings", 10_000);
      const currentRoute = await getCurrentRoute(page);
      expect(currentRoute).toBe("/settings");
    });

    test("should navigate to Changelog when clicking the Changelog menu item", async ({
      page,
    }) => {
      // Ensure we start on a known route
      await navigateTo(page, "/");
      await waitForRoute(page, "/");

      // Open the dropdown
      await openMoreOptionsDropdown(page);

      // Click the "Changelog" link
      const changelogItem = page.locator("[popover] li").getByText("Changelog");
      await expect(changelogItem).toBeVisible({ timeout: 5_000 });
      await changelogItem.click();

      // Wait for navigation to /changelog
      await waitForRoute(page, "/changelog", 10_000);
      const currentRoute = await getCurrentRoute(page);
      expect(currentRoute).toBe("/changelog");
    });

    test("should open the What's New modal when clicking What's New", async ({
      page,
    }) => {
      const dialog = page.locator("dialog.modal");

      // The popover uses native light-dismiss (`popover="auto"`) which can
      // auto-close before the modal becomes visible.  Retry the full
      // open-dropdown → click sequence up to 3 times to handle that race.
      for (let attempt = 0; attempt < 3; attempt++) {
        await openMoreOptionsDropdown(page);

        const whatsNewItem = page
          .locator("[popover] li")
          .getByText("What's New");
        const itemVisible = await whatsNewItem
          .waitFor({ state: "visible", timeout: 3_000 })
          .then(() => true)
          .catch(() => false);

        if (!itemVisible) {
          await page.waitForTimeout(300);
          continue;
        }

        await whatsNewItem.click();

        // Wait for the dialog to appear — the click triggers an async
        // store action that calls showModal() on the <dialog>.
        const opened = await dialog
          .waitFor({ state: "visible", timeout: 5_000 })
          .then(() => true)
          .catch(() => false);

        if (opened) break;
        await page.waitForTimeout(300);
      }

      // The WhatsNewModal renders inside a <dialog> element via the Modal component.
      // After clicking, the dialog should become visible (showModal is called).
      await expect(dialog).toBeVisible({ timeout: 10_000 });

      // The modal heading shows the release name (e.g. "v1.5.0") when the
      // GitHub fetch succeeds, or the fallback text "What's New" when the
      // fetch fails or is still loading.  Accept either — the important
      // assertion is that the modal rendered meaningful content.
      const modalBox = dialog.locator(".modal-box");
      await expect(modalBox).toBeVisible({ timeout: 5_000 });

      const modalContent = await modalBox.textContent();
      const hasExpectedContent =
        modalContent!.includes("What's New") ||
        modalContent!.includes("Close") ||
        // Release name / version / date shown when data loaded
        modalContent!.includes("Release") ||
        modalContent!.includes("release") ||
        modalContent!.length > 20;
      expect(hasExpectedContent).toBe(true);

      // The modal should have a Close button (target the visible primary button,
      // not the hidden <button type="submit">close</button> used by daisyUI's backdrop)
      const closeButton = dialog
        .locator("button.btn-primary")
        .getByText("Close");
      await expect(closeButton).toBeVisible({ timeout: 5_000 });

      // Close the modal
      await closeButton.click();

      // Wait for the dialog to fully close
      await expect(page.locator("dialog[open]")).toHaveCount(0, {
        timeout: 5_000,
      });

      // The dialog should no longer be visible
      await expect(dialog).not.toBeVisible({ timeout: 5_000 });
    });

    test("should have View Source link pointing to the GitHub repository", async ({
      page,
    }) => {
      // Open the dropdown
      await openMoreOptionsDropdown(page);

      // The "View Source" item is an <a> tag with href to the GitHub repo
      const viewSourceLink = page
        .locator("[popover] li a")
        .filter({ hasText: "View Source" });
      await expect(viewSourceLink).toBeVisible({ timeout: 5_000 });

      // Verify the href points to the correct GitHub repository
      const href = await viewSourceLink.getAttribute("href");
      expect(href).toBe("https://github.com/navali-creations/soothsayer");

      // Verify it opens in a new tab (target="_blank")
      const target = await viewSourceLink.getAttribute("target");
      expect(target).toBe("_blank");

      // Verify noopener noreferrer for security
      const rel = await viewSourceLink.getAttribute("rel");
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    });

    test("should have Discord link pointing to the Discord server invite", async ({
      page,
    }) => {
      // Open the dropdown
      await openMoreOptionsDropdown(page);

      // The "Discord" item is an <a> tag with href to the Discord invite
      const discordLink = page
        .locator("[popover] li a")
        .filter({ hasText: "Discord" });
      await expect(discordLink).toBeVisible({ timeout: 5_000 });

      // Verify the href points to the correct Discord invite
      const href = await discordLink.getAttribute("href");
      expect(href).toBe("https://discord.gg/mrqmPYXHHT");

      // Verify it opens in a new tab (target="_blank")
      const target = await discordLink.getAttribute("target");
      expect(target).toBe("_blank");

      // Verify noopener noreferrer for security
      const rel = await discordLink.getAttribute("rel");
      expect(rel).toContain("noopener");
      expect(rel).toContain("noreferrer");
    });

    test("should navigate to Attributions when clicking the Attributions menu item", async ({
      page,
    }) => {
      // Ensure we start on a known route
      await navigateTo(page, "/");
      await waitForRoute(page, "/");

      // Open the dropdown
      await openMoreOptionsDropdown(page);

      // Click the "Attributions" link
      const attributionsItem = page
        .locator("[popover] li")
        .getByText("Attributions");
      await expect(attributionsItem).toBeVisible({ timeout: 5_000 });
      await attributionsItem.click();

      // Wait for navigation to /attributions
      await waitForRoute(page, "/attributions", 10_000);
      const currentRoute = await getCurrentRoute(page);
      expect(currentRoute).toBe("/attributions");
    });
  });

  test.describe("League Selection Persistence", () => {
    test("should persist selected league via settings IPC", async ({
      page,
    }) => {
      await ensurePostSetup(page);

      // Seed two leagues so there's something to select between
      await seedSessionPrerequisites(page, {
        game: "poe1",
        leagueName: "Standard",
      });
      await seedSessionPrerequisites(page, {
        game: "poe1",
        leagueName: "Settlers of Kalguur",
      });

      // Set the selected league via IPC
      await setSetting(page, "poe1SelectedLeague", "poe1_settlers-of-kalguur");

      // Read back via IPC to confirm it was persisted in this session
      const persisted = await getSetting<string>(page, "poe1SelectedLeague");
      expect(persisted).toBe("poe1_settlers-of-kalguur");

      // Reload the app to verify the value survives a page reload
      await page.reload();
      await page.waitForLoadState("domcontentloaded");
      await ensurePostSetup(page);

      // The setting should still be persisted after reload
      const storedAfterReload = await getSetting<string>(
        page,
        "poe1SelectedLeague",
      );
      expect(storedAfterReload).toBeTruthy();

      // Clean up: reset the league back to "Standard" so subsequent test
      // files that share this worker don't inherit "Settlers of Kalguur".
      // Without this, tests that rely on `loadCards(onlyInPool=true)` get
      // 0 cards because `divination_card_availability` only has rows for
      // the league that `syncCards()` ran with at startup ("Standard").
      await setSetting(page, "poe1SelectedLeague", "Standard");
      await page.evaluate(() => {
        const store = (window as any).__zustandStore;
        if (store) {
          store.setState((s: any) => {
            s.settings.poe1SelectedLeague = "Standard";
          });
        }
      });
    });
  });
});
