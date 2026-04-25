import type { Page } from "@playwright/test";

import {
  allOnboardingBeaconIds,
  onboardingBeaconGroups,
} from "../../../renderer/modules/onboarding/onboarding-config/onboarding-labels";
import { expect, test } from "../../helpers/electron-test";
import { setSetting } from "../../helpers/ipc-helpers";
import {
  ensurePostSetup,
  navigateTo,
  waitForHydration,
  waitForRoute,
} from "../../helpers/navigation";
import { seedSessionPrerequisites } from "../../helpers/seed-db";

async function openManageBeacons(page: Page) {
  const accordion = page.locator(".collapse").filter({
    hasText: "Manage Beacons",
  });
  const toggle = accordion.locator("input[type='checkbox']").first();

  if (!(await toggle.isChecked())) {
    await toggle.check({ force: true });
  }

  await expect(page.locator("[data-beacon-id='game-selector']")).toBeVisible({
    timeout: 5_000,
  });
}

test.describe("Onboarding - Beacon Management", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await seedSessionPrerequisites(page);
    await setSetting(page, "onboardingDismissedBeacons", []);
    await page.reload();
    await waitForHydration(page, 30_000);
    await page.locator("aside").waitFor({ state: "visible", timeout: 15_000 });
  });

  test("manages beacons from the Settings page", async ({ page }) => {
    await navigateTo(page, "/settings");
    await waitForRoute(page, "/settings", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

    await expect(
      page.getByRole("heading", { name: /App Help/i }),
    ).toBeVisible();

    await openManageBeacons(page);

    for (const group of onboardingBeaconGroups) {
      const groupLocator = page.locator(`[data-beacon-page='${group.pageId}']`);

      await expect(groupLocator.getByText(group.pageLabel)).toBeVisible();
    }

    await expect(
      page.getByText(/Toggle on keeps a beacon visible in the tour/i),
    ).toBeVisible();

    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(2);

    const gameSelectorRow = page.locator("[data-beacon-id='game-selector']");
    const gameSelectorToggle = gameSelectorRow.getByRole("checkbox", {
      name: /Dismiss Game selector beacon/i,
    });

    const overlayIconRow = page.locator("[data-beacon-id='overlay-icon']");
    const overlayIconToggle = overlayIconRow.getByRole("checkbox", {
      name: /Dismiss Overlay icon beacon/i,
    });

    await expect(gameSelectorToggle).toBeChecked();
    await expect(overlayIconToggle).toBeChecked();

    await gameSelectorToggle.uncheck({ force: true });
    await expect(gameSelectorRow.getByText("Dismissed")).toBeVisible();
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(1);

    await overlayIconToggle.uncheck({ force: true });
    await expect(overlayIconRow.getByText("Dismissed")).toBeVisible();
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(0);

    await gameSelectorRow
      .getByRole("checkbox", { name: /Show Game selector beacon/i })
      .check({ force: true });
    await expect(gameSelectorRow.getByText("Visible in tour")).toBeVisible();
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(1);

    await overlayIconRow
      .getByRole("checkbox", { name: /Show Overlay icon beacon/i })
      .check({ force: true });
    await expect(overlayIconRow.getByText("Visible in tour")).toBeVisible();
    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(2);

    await page
      .getByRole("button", { name: /Dismiss All Beacons/i })
      .click({ force: true });

    for (const group of onboardingBeaconGroups) {
      const groupLocator = page.locator(`[data-beacon-page='${group.pageId}']`);

      await expect(
        groupLocator.getByText(
          `${group.beacons.length} / ${group.beacons.length} dismissed`,
        ),
      ).toBeVisible();
    }

    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(0);

    const dismissed = await page.evaluate(() => {
      return (window as any).electron.settings.get(
        "onboardingDismissedBeacons",
      );
    });

    expect(dismissed).toEqual(allOnboardingBeaconIds);

    await page
      .locator("button[data-onboarding='onboarding-button']")
      .click({ force: true });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 });
    await waitForHydration(page, 30_000);
    await waitForRoute(page, "/settings", 10_000);
    await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });

    await openManageBeacons(page);

    for (const group of onboardingBeaconGroups) {
      const groupLocator = page.locator(`[data-beacon-page='${group.pageId}']`);

      await expect(
        groupLocator.getByText(`0 / ${group.beacons.length} dismissed`),
      ).toBeVisible();
    }

    await expect(
      page.locator("[data-beacon-id='game-selector']").getByRole("checkbox", {
        name: /Dismiss Game selector beacon/i,
      }),
    ).toBeChecked();

    await expect
      .poll(async () => page.locator("[data-repere-trigger]").count(), {
        timeout: 10_000,
      })
      .toBe(2);
  });
});
