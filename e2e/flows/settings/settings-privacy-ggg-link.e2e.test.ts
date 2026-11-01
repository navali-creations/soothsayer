import type { Page } from "@playwright/test";

import { expect, test } from "../../helpers/electron-test";
import { ensurePostSetup } from "../../helpers/navigation";
import { dbExec, dbQuery } from "../../helpers/seed-db";
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
      state.communityUpload.isUnlinking = false;
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
    await expect(
      panel.getByText(
        "Link your Path of Exile account to show your community drop data as verified.",
      ),
    ).toBeVisible();
    await expect(
      panel.getByText(
        "If you choose to verify your data, we associate it with your GGG account.",
      ),
    ).not.toBeVisible();

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
    await expect(
      modal.getByText(/Previously anonymous uploads stay anonymous/),
    ).toBeVisible();
    await expect(
      modal.getByText(/previously verified uploads stay verified and linked/),
    ).toBeVisible();
    expect(await getGggAccountLinkClickCount(page)).toBe(0);

    await modal
      .getByRole("button", { name: /Continue to Path of Exile/i })
      .click();

    await expect
      .poll(() => getGggAccountLinkClickCount(page), { timeout: 5_000 })
      .toBe(1);
  });

  test("waits for unlink confirmation, shows failures, and permits retry", async ({
    app,
    page,
  }) => {
    // Exercise the renderer action through IPC with a controlled identity-switch
    // outcome. Actual local identity ownership is covered below and in main tests.
    await app.evaluate(({ ipcMain }) => {
      const handlers = (
        ipcMain as unknown as {
          _invokeHandlers: Map<
            string,
            (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
          >;
        }
      )._invokeHandlers;
      const channels = ["ggg-auth:logout", "ggg-auth:get-status"];
      const originals = channels.map((channel) => handlers.get(channel)!);
      const fixture = globalThis as typeof globalThis & {
        __gggUnlinkReply?: (success: boolean) => void;
        __restoreGggUnlink?: () => void;
      };
      for (const channel of channels) ipcMain.removeHandler(channel);
      ipcMain.handle(
        channels[0],
        () =>
          new Promise((resolve) => {
            fixture.__gggUnlinkReply = (success) => resolve({ success });
          }),
      );
      ipcMain.handle(channels[1], () => ({
        authenticated: true,
        username: "TestExile",
        accountId: "test-account",
      }));
      fixture.__restoreGggUnlink = () => {
        fixture.__gggUnlinkReply?.(false);
        channels.forEach((channel, index) => {
          ipcMain.removeHandler(channel);
          ipcMain.handle(channel, originals[index]);
        });
        delete fixture.__gggUnlinkReply;
        delete fixture.__restoreGggUnlink;
      };
    });
    try {
      await page.evaluate(() => {
        (window as any).__zustandStore.setState((state: any) => {
          state.communityUpload.gggAuthenticated = true;
          state.communityUpload.gggUsername = "TestExile";
          state.communityUpload.gggAccountId = "test-account";
        });
      });
      const panel = activeSettingsPanel(page);
      const unlink = panel.getByRole("button", { name: "Unlink", exact: true });
      await unlink.click();
      await expect(unlink).toBeDisabled();
      await expect(panel.getByText("TestExile", { exact: true })).toBeVisible();
      await app.evaluate(() =>
        (
          globalThis as typeof globalThis & {
            __gggUnlinkReply?: (success: boolean) => void;
          }
        ).__gggUnlinkReply?.(false),
      );
      await expect(panel.getByRole("alert")).toContainText(
        "could not be unlinked",
      );
      await expect(unlink).toBeEnabled();
      await unlink.click();
      await expect(unlink).toBeDisabled();
      await app.evaluate(() =>
        (
          globalThis as typeof globalThis & {
            __gggUnlinkReply?: (success: boolean) => void;
          }
        ).__gggUnlinkReply?.(true),
      );
      await expect(unlink).not.toBeVisible();
      await expect(
        panel.getByRole("button", { name: /Link GGG Account/i }),
      ).toBeVisible();
      await expect(panel.getByRole("alert")).not.toBeVisible();
      await expect(
        panel.getByRole("checkbox", { name: /Community Drop Rates/ }),
      ).toBeChecked();
    } finally {
      await app.evaluate(() =>
        (
          globalThis as typeof globalThis & { __restoreGggUnlink?: () => void }
        ).__restoreGggUnlink?.(),
      );
    }
  });
  test("refreshes the mounted verification label after a background auth change", async ({
    app,
    page,
  }) => {
    await page.evaluate(() => {
      (window as any).__zustandStore.setState((state: any) => {
        state.communityUpload.gggAuthenticated = true;
        state.communityUpload.gggUsername = "ExpiredExile";
        state.communityUpload.gggAccountId = "expired-account";
      });
    });
    const panel = activeSettingsPanel(page);
    await expect(
      panel.getByText("ExpiredExile", { exact: true }),
    ).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send("ggg-auth:status-changed");
      }
    });
    await expect(
      panel.getByText("ExpiredExile", { exact: true }),
    ).not.toBeVisible();
    await expect(
      panel.getByRole("button", { name: /Link GGG Account/i }),
    ).toBeVisible();
  });

  test("real unlink starts a new anonymous ID and retains verified counters", async ({
    page,
  }) => {
    const verifiedId = "aaaaaaaa-1111-4222-8333-ffffffffffff";
    const before = await dbQuery<{ value: string }>(
      page,
      "SELECT value FROM app_metadata WHERE key = 'device_id'",
    );
    await dbExec(
      page,
      "INSERT INTO community_upload_identities (id, kind, account_id) VALUES (?, 'verified', ?)",
      [verifiedId, "e2e-verified-account"],
    );
    await dbExec(
      page,
      "UPDATE app_metadata SET value = ? WHERE key = 'community_active_upload_identity'",
      [verifiedId],
    );
    await dbExec(
      page,
      "INSERT INTO community_upload_card_counts VALUES (?, 'poe1', 'Standard', 'The Doctor', 7)",
      [verifiedId],
    );
    await dbExec(
      page,
      "INSERT INTO community_upload_snapshot (identity_id, game, scope, card_name, count) VALUES (?, 'poe1', 'Standard', 'The Doctor', 7)",
      [verifiedId],
    );
    await page.evaluate(() => {
      (window as any).__zustandStore.setState((state: any) => {
        state.communityUpload.gggAuthenticated = true;
        state.communityUpload.gggUsername = "TestExile";
        state.communityUpload.gggAccountId = "e2e-verified-account";
      });
    });
    const panel = activeSettingsPanel(page);
    await expect(
      panel.getByText(/Previously verified uploads stay verified and linked/),
    ).toBeVisible();
    await panel.getByRole("button", { name: "Unlink", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: /Link GGG Account/i }),
    ).toBeVisible();
    const active = await dbQuery<{
      id: string;
      kind: string;
      account_id: string | null;
    }>(
      page,
      "SELECT i.* FROM community_upload_identities i JOIN app_metadata m ON m.value = i.id WHERE m.key = 'community_active_upload_identity'",
    );
    expect(active[0]).toMatchObject({ kind: "anonymous", account_id: null });
    expect(active[0].id).not.toBe(verifiedId);
    expect(
      await dbQuery(
        page,
        "SELECT count FROM community_upload_card_counts WHERE identity_id = ?",
        [active[0].id],
      ),
    ).toEqual([]);
    expect(
      await dbQuery(
        page,
        "SELECT count FROM community_upload_snapshot WHERE identity_id = ?",
        [verifiedId],
      ),
    ).toEqual([{ count: 7 }]);
    expect(
      await dbQuery(
        page,
        "SELECT kind, account_id FROM community_upload_identities WHERE id = ?",
        [verifiedId],
      ),
    ).toEqual([{ kind: "verified", account_id: "e2e-verified-account" }]);
    expect(
      await dbQuery(
        page,
        "SELECT value FROM app_metadata WHERE key = 'device_id'",
      ),
    ).toEqual(before);
  });
});
