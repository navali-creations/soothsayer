import { expect, test } from "../../helpers/electron-test";
import { callElectronAPI, setSetting } from "../../helpers/ipc-helpers";
import { ensurePostSetup } from "../../helpers/navigation";
import { dbExec } from "../../helpers/seed-db";
import {
  activeSettingsPanel,
  goToSettings,
  openSettingsTab,
} from "../../helpers/settings";

test.describe("Opening-time and area sharing consent", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await setSetting(page, "communityUploadsEnabled", true);
    await callElectronAPI(
      page,
      "communityUpload",
      "setDropContextConsent",
      false,
    );
    await page.reload();
    await ensurePostSetup(page);
  });

  test("preserves legacy count consent and asks separately for opening times and areas", async ({
    page,
  }) => {
    await dbExec(page, "DELETE FROM app_metadata WHERE key IN (?, ?)", [
      "community_uploads_consent_v1",
      "community_drop_context_consent_v1",
    ]);
    await dbExec(
      page,
      "INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)",
      ["community_backfill_done_poe1_Standard", "true"],
    );
    await dbExec(
      page,
      "INSERT OR IGNORE INTO dismissed_banners (banner_id) VALUES (?)",
      ["community-backfill"],
    );
    // A normal settings write clears the main cache after seeding legacy data.
    const audioEnabled = await callElectronAPI<boolean>(
      page,
      "settings",
      "get",
      "audioEnabled",
    );
    await setSetting(page, "audioEnabled", audioEnabled);
    await page.reload();
    await ensurePostSetup(page);
    await expect(
      callElectronAPI(page, "settings", "get", "communityUploadsEnabled"),
    ).resolves.toBe(true);
    await expect(
      callElectronAPI(page, "communityUpload", "getDropContextConsent"),
    ).resolves.toEqual({ success: true, consent: null });
    const prompt = page.getByRole("region", {
      name: "Choose whether to share opening times and areas",
    });
    await expect(prompt).toBeVisible();
    await expect(
      prompt.getByRole("button", { name: "Agree", exact: true }),
    ).toBeVisible();
    await expect(
      prompt.getByRole("button", { name: "Disagree", exact: true }),
    ).toBeVisible();
    await expect(
      prompt.getByText("These times show time-of-day patterns."),
    ).toBeVisible();
    await page.screenshot({
      path: "e2e/test-results/opening-time-consent-prompt.png",
      animations: "disabled",
    });
    await prompt.getByRole("button", { name: "Disagree", exact: true }).click();
    await expect(prompt).not.toBeVisible();
    await page.reload();
    await ensurePostSetup(page);
    await expect(prompt).not.toBeVisible();
    await expect(
      callElectronAPI(page, "communityUpload", "getDropContextConsent"),
    ).resolves.toEqual({ success: true, consent: false });
    await expect(
      callElectronAPI(page, "settings", "get", "communityUploadsEnabled"),
    ).resolves.toBe(true);
  });

  test("persists opt-in and allows withdrawal without restarting", async ({
    page,
  }) => {
    await goToSettings(page);
    await openSettingsTab(page, "Privacy");
    const panel = activeSettingsPanel(page);
    const info = panel.getByRole("note", { name: "Community data sharing" });
    await expect(info).toContainText(
      "we store a random upload ID with your uploads",
    );
    await expect(info).toContainText(
      "If you verify your data, we associate future uploads with your GGG account",
    );
    const consent = panel.getByRole("checkbox", {
      name: "Opening Times & Areas",
    });
    await expect(consent).not.toBeChecked();
    await consent.check();
    await expect(consent).toBeChecked();
    await expect(
      callElectronAPI(page, "communityUpload", "getDropContextConsent"),
    ).resolves.toEqual({ success: true, consent: true });
    await page.reload();
    await ensurePostSetup(page);
    await goToSettings(page);
    await openSettingsTab(page, "Privacy");
    await expect(consent).toBeChecked();
    await consent.uncheck();
    await expect(consent).not.toBeChecked();
    await expect(
      callElectronAPI(page, "communityUpload", "getDropContextConsent"),
    ).resolves.toEqual({ success: true, consent: false });
    await expect(
      panel.getByRole("checkbox", { name: /Community Drop Rates/ }),
    ).toBeChecked();
    await page.screenshot({
      path: "e2e/test-results/opening-time-consent-settings.png",
      animations: "disabled",
    });
  });

  test("hides time and area sharing until Community Drop Rates is enabled", async ({
    page,
  }) => {
    await goToSettings(page);
    await openSettingsTab(page, "Privacy");
    const panel = activeSettingsPanel(page);
    const uploads = panel.getByRole("checkbox", {
      name: /Community Drop Rates/,
    });
    await uploads.uncheck();
    await expect(panel.getByText("Opening Times & Areas")).not.toBeVisible();
    await expect(
      panel.getByRole("checkbox", {
        name: "Opening Times & Areas",
      }),
    ).not.toBeVisible();
    await expect(
      page.getByRole("region", {
        name: "Choose whether to share opening times and areas",
      }),
    ).not.toBeVisible();
    await uploads.check();
    await expect(
      panel.getByRole("checkbox", {
        name: "Opening Times & Areas",
      }),
    ).toBeVisible();
  });
});
