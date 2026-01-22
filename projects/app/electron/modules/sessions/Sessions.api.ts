import { ipcRenderer } from "electron";
import type {
  DetailedDivinationCardStats,
  GameType,
} from "../../../types/data-stores";
import { SessionsChannel } from "./Sessions.channels";

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
  exchangeChaosToDivine: number;
  stashChaosToDivine: number;
  isActive: boolean;
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
  ): Promise<SessionsPage> =>
    ipcRenderer.invoke(
      SessionsChannel.SearchByCard,
      game,
      cardName,
      page,
      pageSize,
    ),
};

export { SessionsAPI };
export type { SessionSummary, SessionsPage };
