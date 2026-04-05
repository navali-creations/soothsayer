import { ipcRenderer } from "electron";

import type {
  DetailedDivinationCardStats,
  GameType,
} from "../../../types/data-stores";
import { SessionsChannel } from "./Sessions.channels";
import type {
  BiggestLetdownSessionDTO,
  LongestSessionDTO,
  LuckyBreakSessionDTO,
  MostDecksOpenedDTO,
  MostProfitableSessionDTO,
  SessionAveragesDTO,
  SessionChartDataPointDTO,
  SparklinePointDTO,
  TotalNetProfitDTO,
  TotalTimeSpentDTO,
  WinRateDTO,
} from "./Sessions.dto";

interface SessionSummary {
  sessionId: string;
  game: string;
  league: string;
  startedAt: string;
  endedAt: string;
  durationMinutes: number;
  totalDecksOpened: number;
  totalExchangeValue: number;
  totalStashValue: number;
  totalExchangeNetProfit: number | null;
  totalStashNetProfit: number | null;
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
  stackedDeckChaosCost: number;
  isActive: boolean;
  /** Number of this specific card found in the session (only set by searchByCard) */
  cardCount?: number;
}

interface SessionsPage {
  sessions: SessionSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const SessionsAPI = {
  getAll: (
    game: GameType,
    page?: number,
    pageSize?: number,
  ): Promise<SessionsPage> =>
    ipcRenderer.invoke(SessionsChannel.GetAll, game, page, pageSize),
  getById: (sessionId: string): Promise<DetailedDivinationCardStats | null> =>
    ipcRenderer.invoke(SessionsChannel.GetById, sessionId),
  searchByCard: (
    game: GameType,
    cardName: string,
    page?: number,
    pageSize?: number,
    league?: string,
    sortColumn?: "date" | "league" | "found" | "duration" | "decks",
    sortDirection?: "asc" | "desc",
  ): Promise<SessionsPage> =>
    ipcRenderer.invoke(
      SessionsChannel.SearchByCard,
      game,
      cardName,
      page,
      pageSize,
      league,
      sortColumn,
      sortDirection,
    ),
  getMostProfitable: (
    game: GameType,
    league?: string,
  ): Promise<MostProfitableSessionDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetMostProfitable, game, league),
  getLongestSession: (
    game: GameType,
    league?: string,
  ): Promise<LongestSessionDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetLongestSession, game, league),
  getMostDecksOpened: (
    game: GameType,
    league?: string,
  ): Promise<MostDecksOpenedDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetMostDecksOpened, game, league),
  getBiggestLetdown: (
    game: GameType,
    league?: string,
  ): Promise<BiggestLetdownSessionDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetBiggestLetdown, game, league),
  getLuckyBreak: (
    game: GameType,
    league?: string,
  ): Promise<LuckyBreakSessionDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetLuckyBreak, game, league),
  getTotalDecksOpened: (game: GameType, league?: string): Promise<number> =>
    ipcRenderer.invoke(SessionsChannel.GetTotalDecksOpened, game, league),
  getSessionAverages: (
    game: GameType,
    league?: string,
  ): Promise<SessionAveragesDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetSessionAverages, game, league),
  getTotalNetProfit: (
    game: GameType,
    league?: string,
  ): Promise<TotalNetProfitDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetTotalNetProfit, game, league),
  getStackedDeckCardCount: (game: GameType): Promise<number> =>
    ipcRenderer.invoke(SessionsChannel.GetStackedDeckCardCount, game),
  getStackedDeckCardNames: (game: GameType): Promise<string[]> =>
    ipcRenderer.invoke(SessionsChannel.GetStackedDeckCardNames, game),
  getUncollectedCardNames: (
    game: GameType,
    league?: string,
  ): Promise<string[]> =>
    ipcRenderer.invoke(SessionsChannel.GetUncollectedCardNames, game, league),
  getChartData: (
    game: GameType,
    league?: string,
  ): Promise<SessionChartDataPointDTO[]> =>
    ipcRenderer.invoke(SessionsChannel.GetChartData, game, league),
  getTotalTimeSpent: (
    game: GameType,
    league?: string,
  ): Promise<TotalTimeSpentDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetTotalTimeSpent, game, league),
  getWinRate: (game: GameType, league?: string): Promise<WinRateDTO | null> =>
    ipcRenderer.invoke(SessionsChannel.GetWinRate, game, league),
  getSparklines: (
    sessionIds: string[],
  ): Promise<Record<string, SparklinePointDTO[]>> =>
    ipcRenderer.invoke(SessionsChannel.GetSparklines, sessionIds),
};

export type {
  BiggestLetdownSessionDTO,
  LongestSessionDTO,
  LuckyBreakSessionDTO,
  MostDecksOpenedDTO,
  MostProfitableSessionDTO,
  SessionAveragesDTO,
  SessionChartDataPointDTO,
  SessionSummary,
  SessionsPage,
  SparklinePointDTO,
  TotalNetProfitDTO,
  TotalTimeSpentDTO,
  WinRateDTO,
};
export { SessionsAPI };
