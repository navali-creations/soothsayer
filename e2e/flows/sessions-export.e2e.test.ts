/**
 * E2E Test: Multi-session export
 *
 * Covers the Sessions page export menu and export-mode interactions:
 * - more-options menu
 * - Simple/Rich CSV mode entry
 * - card and checkbox selection
 * - Select All / Deselect All
 * - Cancel
 * - generated CSV download payloads
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../helpers/electron-test";
import { ensurePostSetup, navigateTo } from "../helpers/navigation";
import {
  seedMultipleCompletedSessions,
  seedSessionPrerequisites,
} from "../helpers/seed-db";
import { resetSessionsBulkState } from "../helpers/sessions";

interface CapturedDownload {
  filename?: string;
  href: string;
  text?: string;
}

async function goToSessions(page: Page) {
  await navigateTo(page, "/sessions");
  await page
    .getByText("Sessions", { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function seedExportSessions(page: Page) {
  const { leagueId, snapshotId } = await seedSessionPrerequisites(page);

  await seedMultipleCompletedSessions(page, [
    {
      id: "e2e-export-session-a",
      game: "poe1",
      leagueId,
      snapshotId,
      startedAt: "2026-04-19T10:00:00.000Z",
      endedAt: "2026-04-19T11:00:00.000Z",
      cards: [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Humility", count: 20 },
      ],
    },
    {
      id: "e2e-export-session-b",
      game: "poe1",
      leagueId,
      snapshotId,
      startedAt: "2026-04-20T10:00:00.000Z",
      endedAt: "2026-04-20T12:00:00.000Z",
      cards: [
        { cardName: "Humility", count: 10 },
        { cardName: "Carrion Crow", count: 30 },
      ],
    },
    {
      id: "e2e-export-session-c",
      game: "poe1",
      leagueId,
      snapshotId,
      startedAt: "2026-04-21T10:00:00.000Z",
      endedAt: "2026-04-21T12:30:00.000Z",
      cards: [
        { cardName: "The Nurse", count: 1 },
        { cardName: "Rain of Chaos", count: 60 },
      ],
    },
  ]);
}

async function installDownloadCapture(page: Page) {
  await page.evaluate(() => {
    const win = window as typeof window & {
      __sessionDownloads?: CapturedDownload[];
    };
    win.__sessionDownloads = [];

    const originalCreateObjectUrl = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob: Blob | MediaSource) => {
      const href = originalCreateObjectUrl(blob);

      if (blob instanceof Blob) {
        void blob.text().then((text) => {
          const downloads = win.__sessionDownloads ?? [];
          const existing = downloads.find((download) => download.href === href);
          if (existing) {
            existing.text = text;
          } else {
            downloads.push({ href, text });
            win.__sessionDownloads = downloads;
          }
        });
      }

      return href;
    };

    HTMLAnchorElement.prototype.click = function captureAnchorClick() {
      const downloads = win.__sessionDownloads ?? [];
      const existing = downloads.find(
        (download) => download.href === this.href,
      );

      if (existing) {
        existing.filename = this.download;
      } else {
        downloads.push({ filename: this.download, href: this.href });
        win.__sessionDownloads = downloads;
      }
    };
  });
}

async function getCapturedDownload(
  page: Page,
  filenamePrefix: string,
): Promise<CapturedDownload> {
  return expect
    .poll(
      async () =>
        page.evaluate((prefix) => {
          const downloads =
            (
              window as typeof window & {
                __sessionDownloads?: CapturedDownload[];
              }
            ).__sessionDownloads ?? [];

          return downloads.find(
            (download) =>
              download.filename?.startsWith(prefix) && download.text != null,
          );
        }, filenamePrefix),
      { timeout: 5_000 },
    )
    .not.toBeUndefined()
    .then(async () =>
      page.evaluate((prefix) => {
        const downloads =
          (
            window as typeof window & {
              __sessionDownloads?: CapturedDownload[];
            }
          ).__sessionDownloads ?? [];

        const download = downloads.find((item) =>
          item.filename?.startsWith(prefix),
        );
        if (!download) {
          throw new Error(`Missing captured download for ${prefix}`);
        }
        return download;
      }, filenamePrefix),
    );
}

async function openMoreOptions(page: Page) {
  const moreOptions = page.locator("main .dropdown label.btn-square").last();
  await expect(moreOptions).toBeVisible({ timeout: 5_000 });
  await moreOptions.click();
}

test.describe("Sessions multi-session export", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await resetSessionsBulkState(page);
    await seedExportSessions(page);
    await installDownloadCapture(page);
  });

  test("exercises simple and rich export mode interactions", async ({
    page,
  }) => {
    await goToSessions(page);

    const cards = page.locator("main ul li .card");
    await expect(cards).toHaveCount(3, { timeout: 10_000 });
    await expect(page.locator("main input[type='checkbox']")).toHaveCount(0);

    await openMoreOptions(page);
    await expect(
      page.getByRole("button", { name: "Export Simple CSV" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export Rich CSV" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Export Simple CSV" }).click();
    await expect(
      page.locator("main button.btn-error", { hasText: /^Cancel$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Select All" }),
    ).toBeVisible();

    const simpleExportButton = page.getByRole("button", {
      name: "Export Simple CSV (0)",
    });
    await expect(simpleExportButton).toBeDisabled();

    const checkboxes = page.locator("main input[type='checkbox']");
    await expect(checkboxes).toHaveCount(3);
    await expect(checkboxes.nth(0)).not.toBeChecked();

    await page.getByRole("button", { name: "Select All" }).click();
    await expect(
      page.getByRole("button", { name: "Deselect All" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Export Simple CSV (3)" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Deselect All" }).click();
    await expect(
      page.getByRole("button", { name: "Export Simple CSV (0)" }),
    ).toBeDisabled();

    await page.getByRole("button", { name: "Select All" }).click();
    await page.getByRole("button", { name: "Export Simple CSV (3)" }).click();

    const simpleDownload = await getCapturedDownload(page, "sessions-simple-");
    expect(simpleDownload.filename).toMatch(
      /^sessions-simple-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(simpleDownload.text).toContain("name,amount");
    expect(simpleDownload.text).toContain("Carrion Crow,30");
    expect(simpleDownload.text).toContain("Humility,30");
    expect(simpleDownload.text).toContain("Rain of Chaos,60");
    expect(simpleDownload.text).toContain("The Doctor,2");
    expect(simpleDownload.text).toContain("The Nurse,1");

    await page
      .locator("main button.btn-error", { hasText: /^Cancel$/ })
      .click();
    await expect(page.locator("main input[type='checkbox']")).toHaveCount(0);

    await openMoreOptions(page);
    await page.getByRole("button", { name: "Export Rich CSV" }).click();

    await cards.nth(0).click();
    await expect(
      page.getByRole("button", { name: "Export Rich CSV (1)" }),
    ).toBeEnabled();

    await page.locator("main input[type='checkbox']").nth(1).check();
    await expect(
      page.getByRole("button", { name: "Export Rich CSV (2)" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Select All" }).click();
    await expect(
      page.getByRole("button", { name: "Export Rich CSV (3)" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Export Rich CSV (3)" }).click();

    const richDownload = await getCapturedDownload(page, "sessions-rich-");
    expect(richDownload.filename).toMatch(
      /^sessions-rich-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    expect(richDownload.text).toContain(
      "Session Date,League,Duration (min),Decks Opened",
    );
    expect(richDownload.text).toContain("2026-04-19T10:00:00.000Z");
    expect(richDownload.text).toContain("2026-04-20T10:00:00.000Z");
    expect(richDownload.text).toContain("2026-04-21T10:00:00.000Z");
  });
});
