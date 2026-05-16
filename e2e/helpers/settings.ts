import type { Locator } from "@playwright/test";

import { expect, type Page } from "./electron-test";
import { navigateTo, waitForRoute } from "./navigation";

export async function goToSettings(page: Page): Promise<void> {
  await navigateTo(page, "/settings");
  await waitForRoute(page, "/settings", 10_000);
  await page.locator("main").waitFor({ state: "visible", timeout: 5_000 });
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Settings sections" }),
  ).toBeVisible();
}

export function activeSettingsPanel(page: Page): Locator {
  return page
    .locator("[role='tabpanel']")
    .filter({ has: page.locator("section") })
    .first();
}

export async function openSettingsTab(
  page: Page,
  tabName: string,
): Promise<Locator> {
  const tab = page.getByRole("tab", { name: tabName, exact: true });
  await tab.click({ force: true });
  await expect(tab).toBeChecked({ timeout: 5_000 });

  const panel = activeSettingsPanel(page);
  await expect(panel).toBeVisible({ timeout: 5_000 });
  return panel;
}
