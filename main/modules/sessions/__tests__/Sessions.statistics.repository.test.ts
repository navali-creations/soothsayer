import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedDivinationCard,
  seedLeague,
  seedSession,
  seedSessionCards,
  seedSessionSummary,
  seedSnapshot,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { SessionsRepository } from "../Sessions.repository";

describe("SessionsRepository statistics", () => {
  let testDb: TestDatabase;
  let repository: SessionsRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new SessionsRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  async function seedCompletedSessions() {
    const standardLeagueId = await seedLeague(testDb.kysely, {
      game: "poe1",
      name: "Standard",
    });
    const otherLeagueId = await seedLeague(testDb.kysely, {
      game: "poe1",
      name: "Other",
    });
    const snapshotId = await seedSnapshot(testDb.kysely, {
      leagueId: standardLeagueId,
      chaosToDivineRatio: 200,
      stackedDeckChaosCost: 2,
      cardPrices: [
        {
          cardName: "The Doctor",
          chaosValue: 100,
          divineValue: 0.5,
        },
      ],
    });

    const first = await seedSession(testDb.kysely, {
      id: "stats-first",
      game: "poe1",
      leagueId: standardLeagueId,
      snapshotId,
      startedAt: "2026-01-01T10:00:00.000Z",
      endedAt: "2026-01-01T10:30:00.000Z",
      totalCount: 10,
      isActive: false,
    });
    await seedSessionCards(testDb.kysely, first, [
      { cardName: "The Doctor", count: 1 },
    ]);
    await seedSessionSummary(testDb.kysely, {
      sessionId: first,
      league: "Standard",
      durationMinutes: 30,
      totalDecksOpened: 10,
      totalValue: 100,
      netProfit: 80,
      chaosToDivineRatio: 200,
      stackedDeckChaosCost: 2,
    });

    const second = await seedSession(testDb.kysely, {
      id: "stats-second",
      game: "poe1",
      leagueId: standardLeagueId,
      snapshotId,
      startedAt: "2026-01-02T10:00:00.000Z",
      endedAt: "2026-01-02T12:00:00.000Z",
      totalCount: 30,
      isActive: false,
    });
    await seedSessionCards(testDb.kysely, second, [
      { cardName: "The Doctor", count: 2 },
    ]);
    await seedSessionSummary(testDb.kysely, {
      sessionId: second,
      league: "Standard",
      durationMinutes: 120,
      totalDecksOpened: 30,
      totalValue: 200,
      netProfit: -20,
      chaosToDivineRatio: 200,
      stackedDeckChaosCost: 2,
    });

    const third = await seedSession(testDb.kysely, {
      id: "stats-third",
      game: "poe1",
      leagueId: otherLeagueId,
      startedAt: "2026-01-03T10:00:00.000Z",
      endedAt: "2026-01-03T10:00:00.000Z",
      totalCount: 5,
      isActive: false,
    });

    return { first, second, third };
  }

  it("returns null or zero statistics when no completed sessions exist", async () => {
    await expect(
      repository.getMostProfitableSession("poe1"),
    ).resolves.toBeNull();
    await expect(repository.getLongestSession("poe1")).resolves.toBeNull();
    await expect(
      repository.getMostDecksOpenedSession("poe1"),
    ).resolves.toBeNull();
    await expect(
      repository.getBiggestLetdownSession("poe1"),
    ).resolves.toBeNull();
    await expect(repository.getLuckyBreakSession("poe1")).resolves.toBeNull();
    await expect(repository.getTotalNetProfit("poe1")).resolves.toBeNull();
    await expect(repository.getTotalTimeSpent("poe1")).resolves.toBeNull();
    await expect(repository.getWinRate("poe1")).resolves.toBeNull();
    await expect(repository.getTotalDecksOpened("poe1")).resolves.toBe(0);
    await expect(repository.getSessionChartData("poe1")).resolves.toEqual([]);

    await expect(repository.getSessionAverages("poe1")).resolves.toEqual({
      avgProfit: 0,
      avgDecksOpened: 0,
      avgDurationMinutes: 0,
      avgChaosPerDivine: 0,
      sessionCount: 0,
    });
  });

  it("computes all session highlights with and without league filters", async () => {
    await seedCompletedSessions();

    await expect(
      repository.getMostProfitableSession("poe1", "Standard"),
    ).resolves.toMatchObject({
      sessionId: "stats-first",
      profit: 80,
      totalDecksOpened: 10,
    });
    await expect(
      repository.getMostProfitableSession("poe1"),
    ).resolves.toMatchObject({
      sessionId: "stats-first",
    });

    await expect(
      repository.getLongestSession("poe1", "Standard"),
    ).resolves.toMatchObject({
      sessionId: "stats-second",
      durationMinutes: 120,
    });
    await expect(repository.getLongestSession("poe1")).resolves.toBeTruthy();

    await expect(
      repository.getMostDecksOpenedSession("poe1", "Standard"),
    ).resolves.toMatchObject({
      sessionId: "stats-second",
      totalDecksOpened: 30,
    });
    await expect(
      repository.getMostDecksOpenedSession("poe1"),
    ).resolves.toBeTruthy();

    await expect(
      repository.getBiggestLetdownSession("poe1", "Standard"),
    ).resolves.toMatchObject({
      sessionId: "stats-second",
      profit: -20,
    });
    await expect(
      repository.getBiggestLetdownSession("poe1"),
    ).resolves.toBeTruthy();

    await expect(
      repository.getLuckyBreakSession("poe1", "Standard"),
    ).resolves.toMatchObject({
      sessionId: "stats-first",
      profit: 80,
    });
    await expect(repository.getLuckyBreakSession("poe1")).resolves.toBeTruthy();
  });

  it("computes aggregate statistics, chart data, total time, and win rate", async () => {
    await seedCompletedSessions();

    await expect(
      repository.getSessionAverages("poe1", "Standard"),
    ).resolves.toMatchObject({
      avgProfit: 30,
      avgDecksOpened: 20,
      avgDurationMinutes: 75,
      avgChaosPerDivine: 200,
      sessionCount: 2,
    });
    await expect(repository.getSessionAverages("poe1")).resolves.toBeTruthy();

    await expect(
      repository.getTotalNetProfit("poe1", "Standard"),
    ).resolves.toMatchObject({
      totalProfit: 60,
      avgChaosPerDivine: 200,
      avgDeckCost: 2,
    });
    await expect(repository.getTotalNetProfit("poe1")).resolves.toBeTruthy();

    await expect(
      repository.getTotalDecksOpened("poe1", "Standard"),
    ).resolves.toBe(40);
    await expect(repository.getTotalDecksOpened("poe1")).resolves.toBe(45);

    await expect(
      repository.getTotalTimeSpent("poe1", "Standard"),
    ).resolves.toEqual({ totalMinutes: 150 });
    await expect(repository.getTotalTimeSpent("poe1")).resolves.toEqual({
      totalMinutes: 150,
    });

    await expect(repository.getWinRate("poe1", "Standard")).resolves.toEqual({
      profitableSessions: 1,
      totalSessions: 2,
      winRate: 0.5,
    });
    await expect(repository.getWinRate("poe1")).resolves.toMatchObject({
      totalSessions: 3,
    });

    const standardChart = await repository.getSessionChartData(
      "poe1",
      "Standard",
    );
    expect(standardChart).toHaveLength(2);
    expect(standardChart[0]).toMatchObject({
      durationMinutes: 30,
      totalDecksOpened: 10,
      exchangeNetProfit: 80,
      chaosPerDivine: 200,
    });

    const allChart = await repository.getSessionChartData("poe1");
    expect(allChart).toHaveLength(3);
    expect(allChart.at(-1)).toMatchObject({
      durationMinutes: 0,
      exchangeNetProfit: 0,
      chaosPerDivine: 0,
    });
  });

  it("supports every card-search sort and league-count path", async () => {
    const { first } = await seedCompletedSessions();
    await seedSessionCards(testDb.kysely, first, [
      { cardName: "Rain of Chaos", count: 2 },
    ]);

    for (const sortColumn of [
      "league",
      "found",
      "duration",
      "decks",
      "date",
    ] as const) {
      const sessions = await repository.searchSessionsByCard(
        "poe1",
        "The Doctor",
        20,
        0,
        "Standard",
        sortColumn,
        "asc",
      );
      expect(sessions.length).toBeGreaterThan(0);
    }

    await expect(
      repository.getSessionCountByCard("poe1", "The Doctor", "Standard"),
    ).resolves.toBe(2);
  });

  it("lists all-time card pools and validates delete selections", async () => {
    await seedDivinationCard(testDb.kysely, {
      game: "poe1",
      name: "The Doctor",
      stackSize: 8,
    });

    await expect(repository.getStackedDeckCardNames("poe1")).resolves.toEqual([
      "The Doctor",
    ]);
    await expect(repository.getUncollectedCardNames("poe1")).resolves.toEqual([
      "The Doctor",
    ]);

    await expect(repository.deleteSessions("poe1", [])).resolves.toEqual({
      success: false,
      error: "No sessions were selected.",
    });
    await expect(
      repository.deleteSessions("poe1", ["missing-session"]),
    ).resolves.toEqual({
      success: false,
      error: "One or more selected sessions were not found.",
    });
  });
});
