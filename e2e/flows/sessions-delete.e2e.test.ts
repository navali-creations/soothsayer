/**
 * E2E Test: Multi-session delete
 *
 * Covers the Sessions page delete-mode flow:
 * - more-options menu
 * - delete mode entry
 * - card selection
 * - Select All / Deselect All
 * - confirmation modal
 * - deleted sessions disappear from the grid
 * - storage and aggregate stats refresh from the recomputed database state
 */

import type { Page } from "@playwright/test";

import { expect, test } from "../helpers/electron-test";
import {
  callElectronAPI,
  startSession,
  stopSession,
} from "../helpers/ipc-helpers";
import { ensurePostSetup, navigateTo } from "../helpers/navigation";
import {
  seedDataStoreForStatistics,
  seedMultipleCompletedSessions,
  seedSessionPrerequisites,
} from "../helpers/seed-db";
import { resetSessionsBulkState } from "../helpers/sessions";

interface SessionsPageResult {
  sessions: Array<{ sessionId: string; totalDecksOpened: number }>;
  total: number;
}

interface DataStoreStats {
  totalCount: number;
  cards: Record<string, { count: number }>;
}

interface GlobalStats {
  totalStackedDecksOpened: number;
}

interface LeagueStorageUsage {
  leagueId: string;
  leagueName: string;
  game: "poe1" | "poe2";
  sessionCount: number;
}

async function goToSessions(page: Page) {
  await navigateTo(page, "/sessions");
  await page
    .getByText("Sessions", { exact: false })
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function goToSettings(page: Page) {
  await navigateTo(page, "/settings");
  await page
    .locator("main h1", { hasText: "Settings" })
    .waitFor({ state: "visible", timeout: 10_000 });
}

async function openMoreOptions(page: Page) {
  const moreOptions = page.locator("main .dropdown label.btn-square").last();
  await expect(moreOptions).toBeVisible({ timeout: 5_000 });
  await moreOptions.click();
}

async function getAllSessions(page: Page): Promise<SessionsPageResult> {
  return callElectronAPI<SessionsPageResult>(
    page,
    "sessions",
    "getAll",
    "poe1",
  );
}

async function seedDeleteSessions(page: Page) {
  const { leagueId, snapshotId } = await seedSessionPrerequisites(page);

  await seedMultipleCompletedSessions(page, [
    {
      id: "e2e-delete-session-a",
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
      id: "e2e-delete-session-b",
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
      id: "e2e-delete-session-c",
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

  await seedDataStoreForStatistics(page, [
    {
      leagueName: "Standard",
      cards: [
        { cardName: "The Doctor", count: 2 },
        { cardName: "Humility", count: 30 },
        { cardName: "Carrion Crow", count: 30 },
        { cardName: "The Nurse", count: 1 },
        { cardName: "Rain of Chaos", count: 60 },
      ],
    },
  ]);

  return { leagueId };
}

test.describe("Sessions multi-session delete", () => {
  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await resetSessionsBulkState(page);
  });

  test("deletes selected completed sessions and refreshes dependent data", async ({
    page,
  }) => {
    const { leagueId } = await seedDeleteSessions(page);

    await goToSessions(page);

    const cards = page.locator("main ul li .card");
    await expect(cards).toHaveCount(3, { timeout: 10_000 });
    await expect(page.locator("main input[type='checkbox']")).toHaveCount(0);

    await openMoreOptions(page);
    await expect(
      page.getByRole("button", { name: "Delete sessions" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Delete sessions" }).click();

    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Select All" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete sessions (0)" }),
    ).toBeDisabled();

    const checkboxes = page.locator("main input[type='checkbox']");
    await expect(checkboxes).toHaveCount(3);

    await page.getByRole("button", { name: "Select All" }).click();
    await expect(
      page.getByRole("button", { name: "Deselect All" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Delete sessions (3)" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Deselect All" }).click();
    await expect(
      page.getByRole("button", { name: "Delete sessions (0)" }),
    ).toBeDisabled();

    await cards.nth(0).click();
    await cards.nth(1).click();
    await expect(
      page.getByRole("button", { name: "Delete sessions (2)" }),
    ).toBeEnabled();

    await page.getByRole("button", { name: "Delete sessions (2)" }).click();
    const dialog = page.locator("dialog");
    await expect(
      dialog.getByText("This action cannot be undone."),
    ).toBeVisible();
    await expect(
      dialog.getByText(/Aggregate card statistics and total stacked decks/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: /^Delete sessions$/ }).click();

    await expect(cards).toHaveCount(1, { timeout: 10_000 });
    await expect(page.locator("main input[type='checkbox']")).toHaveCount(0);

    const sessions = await getAllSessions(page);
    expect(sessions.total).toBe(1);
    expect(sessions.sessions.map((session) => session.sessionId)).toEqual([
      "e2e-delete-session-a",
    ]);

    await expect(
      callElectronAPI(page, "sessions", "getById", "e2e-delete-session-b"),
    ).resolves.toBeNull();
    await expect(
      callElectronAPI(page, "sessions", "getById", "e2e-delete-session-c"),
    ).resolves.toBeNull();

    const allTimeStats = await callElectronAPI<DataStoreStats>(
      page,
      "dataStore",
      "getAllTime",
      "poe1",
    );
    expect(allTimeStats.totalCount).toBe(22);
    expect(allTimeStats.cards["The Doctor"]?.count).toBe(2);
    expect(allTimeStats.cards.Humility?.count).toBe(20);
    expect(allTimeStats.cards["Carrion Crow"]).toBeUndefined();
    expect(allTimeStats.cards["The Nurse"]).toBeUndefined();
    expect(allTimeStats.cards["Rain of Chaos"]).toBeUndefined();

    const globalStats = await callElectronAPI<GlobalStats>(
      page,
      "dataStore",
      "getGlobal",
    );
    expect(globalStats.totalStackedDecksOpened).toBe(22);

    await goToSettings(page);
    await expect(page.getByText("Storage", { exact: true })).toBeVisible();
    const leagueUsage = await callElectronAPI<LeagueStorageUsage[]>(
      page,
      "storage",
      "getLeagueUsage",
    );
    const standardUsage = leagueUsage.find(
      (usage) => usage.leagueId === leagueId,
    );
    expect(standardUsage?.sessionCount).toBe(1);
  });

  test("blocks deletion when an active session is selected", async ({
    page,
  }) => {
    const { leagueId, snapshotId } = await seedSessionPrerequisites(page);
    await seedMultipleCompletedSessions(page, [
      {
        id: "e2e-delete-active-completed-a",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2026-04-18T10:00:00.000Z",
        endedAt: "2026-04-18T11:00:00.000Z",
        cards: [{ cardName: "Humility", count: 3 }],
      },
      {
        id: "e2e-delete-active-completed-b",
        game: "poe1",
        leagueId,
        snapshotId,
        startedAt: "2026-04-18T12:00:00.000Z",
        endedAt: "2026-04-18T13:00:00.000Z",
        cards: [{ cardName: "The Doctor", count: 1 }],
      },
    ]);

    await startSession(page, "poe1", "Standard");

    try {
      const before = await getAllSessions(page);

      await goToSessions(page);
      await openMoreOptions(page);
      await page.getByRole("button", { name: "Delete sessions" }).click();
      await page.getByRole("button", { name: "Select All" }).click();
      await page
        .getByRole("button", { name: /Delete sessions \(\d+\)/ })
        .click();

      const dialog = page.locator("dialog");
      await dialog.getByRole("button", { name: /^Delete sessions$/ }).click();

      await expect(
        dialog.getByText("Active sessions cannot be deleted."),
      ).toBeVisible({ timeout: 10_000 });

      const after = await getAllSessions(page);
      expect(after.total).toBe(before.total);
      await expect(
        callElectronAPI(
          page,
          "sessions",
          "getById",
          "e2e-delete-active-completed-a",
        ),
      ).resolves.not.toBeNull();
      await expect(
        callElectronAPI(
          page,
          "sessions",
          "getById",
          "e2e-delete-active-completed-b",
        ),
      ).resolves.not.toBeNull();
    } finally {
      await stopSession(page, "poe1").catch(() => undefined);
    }
  });
});
