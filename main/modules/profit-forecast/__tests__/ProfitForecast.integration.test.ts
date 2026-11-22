import { readFileSync } from "node:fs";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createTestDatabase,
  seedLeague,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import {
  createDatabaseServiceMock,
  createElectronMock,
  createLoggerServiceMock,
  createSettingsStoreMock,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingletons } from "~/main/modules/__test-utils__/singleton-helper";
import { DivinationCardsService } from "~/main/modules/divination-cards/DivinationCards.service";
import { PoeLeaguesRepository } from "~/main/modules/poe-leagues/PoeLeagues.repository";
import { resolvePoe1CardsJsonPath } from "~/main/utils/resolve-poe1-package-path";

import { ProfitForecastService } from "../ProfitForecast.service";

const { mockGetKysely, mockSettingsGet } = vi.hoisted(() => ({
  mockGetKysely: vi.fn(),
  mockSettingsGet: vi.fn(),
}));

vi.mock("electron", () => createElectronMock());
vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);
vi.mock("~/main/modules/settings-store", () =>
  createSettingsStoreMock({ mockGet: mockSettingsGet }),
);
vi.mock("~/main/modules/logger", () => createLoggerServiceMock());

describe("Profit Forecast bundled weights integration", () => {
  let testDb: TestDatabase;

  beforeEach(async () => {
    resetSingletons(DivinationCardsService, ProfitForecastService);
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);
    mockSettingsGet.mockResolvedValue(null);
    await new PoeLeaguesRepository(testDb.kysely).upsertLeague({
      id: "poe1_Covens",
      game: "poe1",
      leagueId: "Covens",
      name: "Covens",
      isActive: true,
      startAt: null,
      endAt: null,
      updatedAt: null,
      fetchedAt: new Date().toISOString(),
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await testDb.close();
    resetSingletons(DivinationCardsService, ProfitForecastService);
    vi.clearAllMocks();
  });

  it("rejects invented leagues before importing any card data", async () => {
    const importSpy = vi.spyOn(
      DivinationCardsService.getInstance(),
      "ensurePoe1LeagueData",
    );

    await expect(
      ProfitForecastService.getInstance().getData(
        "poe1",
        "Audit No Such League",
      ),
    ).rejects.toThrow("Select an active league");

    expect(importSpy).not.toHaveBeenCalled();
    for (const table of [
      "divination_cards",
      "divination_card_availability",
      "divination_card_rarities",
    ] as const) {
      expect(
        await testDb.kysely.selectFrom(table).selectAll().execute(),
      ).toEqual([]);
    }
  });

  it("rejects inactive leagues before importing weights", async () => {
    await testDb.kysely
      .updateTable("poe_leagues_cache")
      .set({ is_active: 0 })
      .where("league_id", "=", "Covens")
      .execute();

    await expect(
      ProfitForecastService.getInstance().getData("poe1", "Covens"),
    ).rejects.toThrow("Select an active league");
    expect(
      await testDb.kysely
        .selectFrom("divination_card_availability")
        .selectAll()
        .execute(),
    ).toEqual([]);
  });

  it.each(["Standard", "Hardcore"])(
    "loads the bundled fallback for %s without a challenge league or cached league list",
    async (league) => {
      await testDb.kysely.deleteFrom("poe_leagues_cache").execute();

      const result = await ProfitForecastService.getInstance().getData(
        "poe1",
        league,
      );

      expect(result.rows.length).toBeGreaterThan(0);
      expect(result.totalWeight).toBeGreaterThan(0);
      expect(result.snapshotFetchedAt).toBeNull();
    },
  );

  it("allows an active league to use the bundled fallback before its snapshot ships", async () => {
    await new PoeLeaguesRepository(testDb.kysely).upsertLeague({
      id: "poe1_next_league",
      game: "poe1",
      leagueId: "Next League",
      name: "Next League",
      isActive: true,
      startAt: null,
      endAt: null,
      updatedAt: null,
      fetchedAt: new Date().toISOString(),
    });

    const result = await ProfitForecastService.getInstance().getData(
      "poe1",
      "Next League",
    );

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.totalWeight).toBeGreaterThan(0);
    expect(result.snapshotFetchedAt).toBeNull();
  });

  it("loads the onboarding league on a fresh install without legacy weight tables or a restart", async () => {
    // Startup runs before onboarding chooses a league, so only Standard exists.
    await DivinationCardsService.getInstance().initialize();
    expect(
      await testDb.kysely
        .selectFrom("divination_card_availability")
        .select("league")
        .where("league", "=", "Standard")
        .executeTakeFirst(),
    ).toBeDefined();
    expect(
      await testDb.kysely
        .selectFrom("divination_card_availability")
        .select("league")
        .where("league", "=", "Covens")
        .executeTakeFirst(),
    ).toBeUndefined();
    expect(
      testDb.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name LIKE 'prohibited_library_%'",
        )
        .all(),
    ).toEqual([]);

    mockSettingsGet.mockResolvedValue("Covens");
    const leagueId = await seedLeague(testDb.kysely, { name: "Covens" });
    await seedSnapshot(testDb.kysely, {
      leagueId,
      cardPrices: [
        { cardName: "The Doctor", chaosValue: 1200, divineValue: 6 },
      ],
    });

    const result = await ProfitForecastService.getInstance().getData(
      "poe1",
      "Covens",
    );
    const bundledCards: {
      name: string;
      weight: number | null;
      from_boss?: boolean;
      is_disabled?: boolean;
    }[] = JSON.parse(
      readFileSync(resolvePoe1CardsJsonPath("Covens", false), "utf-8"),
    );
    const eligibleCards = bundledCards.filter(
      (card) => !card.from_boss && !card.is_disabled,
    );

    expect(result.rows).toHaveLength(eligibleCards.length);
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.totalWeight).toBeGreaterThan(0);
    expect(result.evPerDeck).toBeGreaterThan(0);
    expect(result.snapshotFetchedAt).not.toBeNull();
    for (const card of eligibleCards) {
      if (card.weight === null || card.weight <= 0) continue;
      expect(
        result.rows.find((row) => row.cardName === card.name)?.weight,
      ).toBe(card.weight);
    }
  });

  it("loads weights before any prices exist when the requested league has not been imported", async () => {
    const result = await ProfitForecastService.getInstance().getData(
      "poe1",
      "Covens",
    );

    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.totalWeight).toBeGreaterThan(0);
    expect(result.snapshotFetchedAt).toBeNull();
    expect(result.rows.every((row) => !row.hasPrice)).toBe(true);
  });

  it("shares the league import across simultaneous fresh-install requests", async () => {
    const service = ProfitForecastService.getInstance();
    const results = await Promise.all([
      service.getData("poe1", "Covens"),
      service.getData("poe1", "Covens"),
    ]);

    expect(results[0].rows.length).toBeGreaterThan(0);
    expect(results[1].rows).toEqual(results[0].rows);
  });
});
