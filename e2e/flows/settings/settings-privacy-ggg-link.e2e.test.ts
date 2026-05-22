import type { Page } from "@playwright/test";

import { expect, test } from "../../helpers/electron-test";
import { ensurePostSetup } from "../../helpers/navigation";
import {
  activeSettingsPanel,
  goToSettings,
  openSettingsTab,
} from "../../helpers/settings";

async function installGggAccountLinkSpy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__zustandStore;
    if (!store) {
      throw new Error("__zustandStore is not available");
    }

    (window as any).__gggAccountLinkClicks = 0;
    (window as any).__originalGggAuthenticate =
      store.getState().communityUpload.authenticate;

    store.setState((state: any) => {
      state.settings.communityUploadsEnabled = true;
      state.communityUpload.gggAuthenticated = false;
      state.communityUpload.gggUsername = null;
      state.communityUpload.gggAccountId = null;
      state.communityUpload.isAuthenticating = false;
      state.communityUpload.authError = null;
      state.communityUpload.authenticate = async () => {
        (window as any).__gggAccountLinkClicks += 1;
        store.setState((nextState: any) => {
          nextState.communityUpload.isAuthenticating = false;
          nextState.communityUpload.authError =
            "E2E stopped before opening Path of Exile";
        });
      };
    });
  });
}

async function restoreGggAccountLinkSpy(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as any).__zustandStore;
    const originalAuthenticate = (window as any).__originalGggAuthenticate;

    if (store && originalAuthenticate) {
      store.setState((state: any) => {
        state.communityUpload.authenticate = originalAuthenticate;
        state.communityUpload.isAuthenticating = false;
        state.communityUpload.authError = null;
      });
    }

    delete (window as any).__gggAccountLinkClicks;
    delete (window as any).__originalGggAuthenticate;
  });
}

async function getGggAccountLinkClickCount(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__gggAccountLinkClicks ?? 0);
}

test.describe("Settings - GGG account linking", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await goToSettings(page);
    await openSettingsTab(page, "Privacy");
    await installGggAccountLinkSpy(page);
  });

  test.afterEach(async ({ page }) => {
    await restoreGggAccountLinkSpy(page);
  });

  test("shows the confirmation modal before starting account linking", async ({
    page,
  }) => {
    const panel = activeSettingsPanel(page);
    const linkButton = panel.getByRole("button", {
      name: /Link GGG Account/i,
    });

    await expect(linkButton).toBeVisible({ timeout: 5_000 });
    await expect(
      panel.getByText("Uploading without a linked account"),
    ).toBeVisible();

    await linkButton.click();

    const modal = page.locator("dialog[open]");
    await expect(modal).toBeVisible();
    await expect(
      modal.getByRole("heading", { name: "Link GGG Account" }),
    ).toBeVisible();
    await expect(
      modal.getByText("This opens the official Path of Exile website."),
    ).toBeVisible();
    await expect(modal.getByText("Your account name")).toBeVisible();
    await expect(modal.getByText("Your account ID")).toBeVisible();
    await expect(modal.getByText("Your password")).toBeVisible();
    await expect(modal.getByText("Your stash tabs or items")).toBeVisible();
    expect(await getGggAccountLinkClickCount(page)).toBe(0);

    await modal
      .getByRole("button", { name: /Continue to Path of Exile/i })
      .click();

    await expect
      .poll(() => getGggAccountLinkClickCount(page), { timeout: 5_000 })
      .toBe(1);
  });
});
