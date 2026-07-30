import { beforeEach, describe, expect, it, vi } from "vitest";

import { getIpcHandler } from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

const {
  mockIpcHandle,
  mockGetMostProfitableSession,
  mockGetLongestSession,
  mockGetSessionAverages,
  mockGetTotalNetProfit,
  mockGetMostDecksOpenedSession,
  mockGetBiggestLetdownSession,
  mockGetLuckyBreakSession,
  mockGetTotalDecksOpened,
  mockGetStackedDeckCardCount,
  mockGetStackedDeckCardNames,
  mockGetUncollectedCardNames,
  mockGetSessionChartData,
  mockGetTotalTimeSpent,
  mockGetWinRate,
  mockGetCardPoolBreakdown,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockGetMostProfitableSession: vi.fn(),
  mockGetLongestSession: vi.fn(),
  mockGetSessionAverages: vi.fn(),
  mockGetTotalNetProfit: vi.fn(),
  mockGetMostDecksOpenedSession: vi.fn(),
  mockGetBiggestLetdownSession: vi.fn(),
  mockGetLuckyBreakSession: vi.fn(),
  mockGetTotalDecksOpened: vi.fn(),
  mockGetStackedDeckCardCount: vi.fn(),
  mockGetStackedDeckCardNames: vi.fn(),
  mockGetUncollectedCardNames: vi.fn(),
  mockGetSessionChartData: vi.fn(),
  mockGetTotalTimeSpent: vi.fn(),
  mockGetWinRate: vi.fn(),
  mockGetCardPoolBreakdown: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
}));

vi.mock("~/main/modules/database", () => ({
  DatabaseService: {
    getInstance: () => ({
      getKysely: () => ({}),
    }),
  },
}));

vi.mock("~/main/modules/snapshots", () => ({
  SnapshotService: {
    getInstance: () => ({
      loadSnapshot: vi.fn(),
    }),
  },
}));

vi.mock("../Sessions.repository", () => ({
  SessionsRepository: class {
    getMostProfitableSession = mockGetMostProfitableSession;
    getLongestSession = mockGetLongestSession;
    getSessionAverages = mockGetSessionAverages;
    getTotalNetProfit = mockGetTotalNetProfit;
    getMostDecksOpenedSession = mockGetMostDecksOpenedSession;
    getBiggestLetdownSession = mockGetBiggestLetdownSession;
    getLuckyBreakSession = mockGetLuckyBreakSession;
    getTotalDecksOpened = mockGetTotalDecksOpened;
    getStackedDeckCardCount = mockGetStackedDeckCardCount;
    getStackedDeckCardNames = mockGetStackedDeckCardNames;
    getUncollectedCardNames = mockGetUncollectedCardNames;
    getSessionChartData = mockGetSessionChartData;
    getTotalTimeSpent = mockGetTotalTimeSpent;
    getWinRate = mockGetWinRate;
    getCardPoolBreakdown = mockGetCardPoolBreakdown;
  },
}));

import { SessionsChannel } from "../Sessions.channels";
import { SessionsService } from "../Sessions.service";

const normalizedLeagueCases = [
  [SessionsChannel.GetMostProfitable, mockGetMostProfitableSession],
  [SessionsChannel.GetLongestSession, mockGetLongestSession],
  [SessionsChannel.GetSessionAverages, mockGetSessionAverages],
  [SessionsChannel.GetTotalNetProfit, mockGetTotalNetProfit],
  [SessionsChannel.GetMostDecksOpened, mockGetMostDecksOpenedSession],
  [SessionsChannel.GetBiggestLetdown, mockGetBiggestLetdownSession],
  [SessionsChannel.GetLuckyBreak, mockGetLuckyBreakSession],
  [SessionsChannel.GetTotalDecksOpened, mockGetTotalDecksOpened],
  [SessionsChannel.GetChartData, mockGetSessionChartData],
  [SessionsChannel.GetTotalTimeSpent, mockGetTotalTimeSpent],
  [SessionsChannel.GetWinRate, mockGetWinRate],
  [SessionsChannel.GetCardPoolBreakdown, mockGetCardPoolBreakdown],
] as const;

const directLeagueCases = [
  [SessionsChannel.GetStackedDeckCardCount, mockGetStackedDeckCardCount],
  [SessionsChannel.GetStackedDeckCardNames, mockGetStackedDeckCardNames],
  [SessionsChannel.GetUncollectedCardNames, mockGetUncollectedCardNames],
] as const;

describe("SessionsService statistics IPC", () => {
  beforeEach(() => {
    resetSingleton(SessionsService);
    vi.clearAllMocks();
    for (const [, repositoryMethod] of [
      ...normalizedLeagueCases,
      ...directLeagueCases,
    ]) {
      repositoryMethod.mockResolvedValue({ value: 1 });
    }
    SessionsService.getInstance();
  });

  it.each(
    normalizedLeagueCases,
  )("%s normalizes league filters and validates the game", async (channel, repositoryMethod) => {
    const handler = getIpcHandler(mockIpcHandle, channel);

    await expect(handler({}, "poe1", "Standard")).resolves.toEqual({
      value: 1,
    });
    expect(repositoryMethod).toHaveBeenLastCalledWith("poe1", "Standard");

    await handler({}, "poe1", "all");
    expect(repositoryMethod).toHaveBeenLastCalledWith("poe1", undefined);

    await handler({}, "poe1", undefined);
    expect(repositoryMethod).toHaveBeenLastCalledWith("poe1", undefined);

    await expect(handler({}, "invalid", "Standard")).resolves.toMatchObject({
      success: false,
    });
  });

  it.each(
    directLeagueCases,
  )("%s preserves optional league filters and validates the game", async (channel, repositoryMethod) => {
    const handler = getIpcHandler(mockIpcHandle, channel);

    await expect(handler({}, "poe2", "Standard")).resolves.toEqual({
      value: 1,
    });
    expect(repositoryMethod).toHaveBeenLastCalledWith("poe2", "Standard");

    await handler({}, "poe2", undefined);
    expect(repositoryMethod).toHaveBeenLastCalledWith("poe2", undefined);

    await expect(handler({}, null, "Standard")).resolves.toMatchObject({
      success: false,
    });
  });
});
