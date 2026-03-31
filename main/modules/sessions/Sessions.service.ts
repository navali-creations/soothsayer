import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { SnapshotService } from "~/main/modules/snapshots";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";
import {
  assertCardName,
  assertGameType,
  assertOptionalString,
  assertPage,
  assertPageSize,
  assertSessionId,
  handleValidationError,
} from "~/main/utils/ipc-validation";

import type {
  DetailedDivinationCardStats,
  GameType,
} from "../../../types/data-stores";
import { SessionsChannel } from "./Sessions.channels";
import type { SessionSummaryDTO, SessionsPageDTO } from "./Sessions.dto";
import { SessionsRepository } from "./Sessions.repository";

class SessionsService {
  private static _instance: SessionsService;
  private repository: SessionsRepository;
  private snapshotService: SnapshotService;

  static getInstance(): SessionsService {
    if (!SessionsService._instance) {
      SessionsService._instance = new SessionsService();
    }
    return SessionsService._instance;
  }

  private constructor() {
    const db = DatabaseService.getInstance();
    this.repository = new SessionsRepository(db.getKysely());
    this.snapshotService = SnapshotService.getInstance();
    this.setupHandlers();
  }

  private setupHandlers() {
    ipcMain.handle(
      SessionsChannel.GetAll,
      async (
        _event,
        game: "poe1" | "poe2",
        page: number = 1,
        pageSize: number = 20,
      ): Promise<SessionsPageDTO | { success: false; error: string }> => {
        try {
          assertGameType(game, SessionsChannel.GetAll);
          const validatedPage = assertPage(page, SessionsChannel.GetAll);
          const validatedPageSize = assertPageSize(
            pageSize,
            SessionsChannel.GetAll,
          );
          return this.getAllSessions(game, validatedPage, validatedPageSize);
        } catch (error) {
          return handleValidationError(error, SessionsChannel.GetAll);
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetById,
      async (_event, sessionId: string) => {
        try {
          assertSessionId(sessionId, SessionsChannel.GetById);
          return this.getSessionById(sessionId);
        } catch (error) {
          return handleValidationError(error, SessionsChannel.GetById);
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.SearchByCard,
      async (
        _event,
        game: "poe1" | "poe2",
        cardName: string,
        page: number = 1,
        pageSize: number = 20,
        league?: string,
        sortColumn?: string,
        sortDirection?: string,
      ): Promise<SessionsPageDTO | { success: false; error: string }> => {
        try {
          assertGameType(game, SessionsChannel.SearchByCard);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.SearchByCard,
            256,
          );
          assertCardName(cardName, SessionsChannel.SearchByCard);
          const validatedPage = assertPage(page, SessionsChannel.SearchByCard);
          const validatedPageSize = assertPageSize(
            pageSize,
            SessionsChannel.SearchByCard,
          );
          // Normalize league: "all" or empty → undefined (no filter)
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.searchSessionsByCard(
            game,
            cardName,
            validatedPage,
            validatedPageSize,
            leagueFilter,
            sortColumn as
              | "date"
              | "league"
              | "found"
              | "duration"
              | "decks"
              | undefined,
            sortDirection as "asc" | "desc" | undefined,
          );
        } catch (error) {
          return handleValidationError(error, SessionsChannel.SearchByCard);
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetMostProfitable,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetMostProfitable);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetMostProfitable,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getMostProfitableSession(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetMostProfitable,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetLongestSession,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetLongestSession);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetLongestSession,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getLongestSession(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetLongestSession,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetSessionAverages,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetSessionAverages);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetSessionAverages,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getSessionAverages(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetSessionAverages,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetTotalNetProfit,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetTotalNetProfit);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetTotalNetProfit,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getTotalNetProfit(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetTotalNetProfit,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetMostDecksOpened,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetMostDecksOpened);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetMostDecksOpened,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getMostDecksOpenedSession(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetMostDecksOpened,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetBiggestLetdown,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetBiggestLetdown);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetBiggestLetdown,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getBiggestLetdownSession(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetBiggestLetdown,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetLuckyBreak,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetLuckyBreak);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetLuckyBreak,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getLuckyBreakSession(game, leagueFilter);
        } catch (error) {
          return handleValidationError(error, SessionsChannel.GetLuckyBreak);
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetTotalDecksOpened,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetTotalDecksOpened);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetTotalDecksOpened,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getTotalDecksOpened(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetTotalDecksOpened,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetStackedDeckCardCount,
      async (_event, game: GameType) => {
        try {
          assertGameType(game, SessionsChannel.GetStackedDeckCardCount);
          return this.repository.getStackedDeckCardCount(game);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetStackedDeckCardCount,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetStackedDeckCardNames,
      async (_event, game: GameType) => {
        try {
          assertGameType(game, SessionsChannel.GetStackedDeckCardNames);
          return this.repository.getStackedDeckCardNames(game);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetStackedDeckCardNames,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetUncollectedCardNames,
      async (_event, game: GameType, league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetUncollectedCardNames);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetUncollectedCardNames,
            256,
          );
          return this.repository.getUncollectedCardNames(game, league);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetUncollectedCardNames,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetChartData,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetChartData);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetChartData,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getSessionChartData(game, leagueFilter);
        } catch (error) {
          return handleValidationError(error, SessionsChannel.GetChartData);
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetTotalTimeSpent,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetTotalTimeSpent);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetTotalTimeSpent,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getTotalTimeSpent(game, leagueFilter);
        } catch (error) {
          return handleValidationError(
            error,
            SessionsChannel.GetTotalTimeSpent,
          );
        }
      },
    );

    ipcMain.handle(
      SessionsChannel.GetWinRate,
      async (_event, game: "poe1" | "poe2", league?: string) => {
        try {
          assertGameType(game, SessionsChannel.GetWinRate);
          assertOptionalString(
            league,
            "league",
            SessionsChannel.GetWinRate,
            256,
          );
          const leagueFilter = league && league !== "all" ? league : undefined;
          return this.repository.getWinRate(game, leagueFilter);
        } catch (error) {
          return handleValidationError(error, SessionsChannel.GetWinRate);
        }
      },
    );
  }

  /**
   * Get all sessions for a game with pagination
   */
  private async getAllSessions(
    game: "poe1" | "poe2",
    page: number = 1,
    pageSize: number = 20,
  ): Promise<SessionsPageDTO> {
    // Get total count
    const total = await this.repository.getSessionCount(game);
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Get paginated sessions
    const sessions = await this.repository.getSessionsPage(
      game,
      pageSize,
      offset,
    );

    return {
      sessions,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  /**
   * Get a specific session by ID with full details
   */
  public async getSessionById(
    sessionId: string,
  ): Promise<DetailedDivinationCardStats | null> {
    // Get session details
    const session = await this.repository.getSessionById(sessionId);
    if (!session) return null;

    // Get session cards
    const cards = await this.repository.getSessionCards(sessionId);

    // Load snapshot
    const priceSnapshot = session.snapshotId
      ? (await this.snapshotService.loadSnapshot(session.snapshotId)) ||
        undefined
      : undefined;

    // Build cards object
    const cardsObject: Record<string, any> = {};

    for (const card of cards) {
      const cardEntry: any = {
        count: card.count,
        processedIds: [],
      };

      // Add divination card metadata if available
      if (card.divinationCard) {
        cardEntry.divinationCard = {
          id: card.divinationCard.id,
          stackSize: card.divinationCard.stackSize,
          description: card.divinationCard.description,
          rewardHtml: cleanWikiMarkup(card.divinationCard.rewardHtml),
          artSrc: card.divinationCard.artSrc,
          flavourHtml: cleanWikiMarkup(card.divinationCard.flavourHtml),
          rarity: card.divinationCard.rarity,
        };
      }

      // Add prices if snapshot available
      if (priceSnapshot) {
        const exchangeData = priceSnapshot.exchange.cardPrices[card.cardName];
        const stashData = priceSnapshot.stash.cardPrices[card.cardName];

        // Always add price objects (even if no data) so hidePrice flag is available
        cardEntry.exchangePrice = exchangeData
          ? {
              chaosValue: exchangeData.chaosValue,
              divineValue: exchangeData.divineValue,
              totalValue: exchangeData.chaosValue * card.count,
              hidePrice: card.hidePriceExchange,
            }
          : {
              chaosValue: 0,
              divineValue: 0,
              totalValue: 0,
              hidePrice: card.hidePriceExchange,
            };

        cardEntry.stashPrice = stashData
          ? {
              chaosValue: stashData.chaosValue,
              divineValue: stashData.divineValue,
              totalValue: stashData.chaosValue * card.count,
              hidePrice: card.hidePriceStash,
            }
          : {
              chaosValue: 0,
              divineValue: 0,
              totalValue: 0,
              hidePrice: card.hidePriceStash,
            };
      }

      cardsObject[card.cardName] = cardEntry;
    }

    // Calculate totals
    let stashTotal = 0;
    let exchangeTotal = 0;

    for (const cardData of Object.values(cardsObject)) {
      if (cardData.stashPrice && !cardData.stashPrice.hidePrice) {
        stashTotal += cardData.stashPrice.totalValue;
      }
      if (cardData.exchangePrice && !cardData.exchangePrice.hidePrice) {
        exchangeTotal += cardData.exchangePrice.totalValue;
      }
    }

    const deckCost = priceSnapshot?.stackedDeckChaosCost ?? 0;
    const totalDeckCost = deckCost * session.totalCount;

    const totals = priceSnapshot
      ? {
          stash: {
            totalValue: stashTotal,
            netProfit: stashTotal - totalDeckCost,
            chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
          },
          exchange: {
            totalValue: exchangeTotal,
            netProfit: exchangeTotal - totalDeckCost,
            chaosToDivineRatio: priceSnapshot.exchange.chaosToDivineRatio,
          },
          stackedDeckChaosCost: deckCost,
          totalDeckCost,
        }
      : undefined;

    // Convert cards object to array
    const cardsArray = Object.entries(cardsObject).map(([cardName, entry]) => ({
      ...entry,
      name: cardName,
    }));

    return {
      id: session.id,
      totalCount: session.totalCount,
      cards: cardsArray,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      league: session.league,
      priceSnapshot,
      totals,
    };
  }

  /**
   * Search sessions by card name with pagination
   */
  private async searchSessionsByCard(
    game: "poe1" | "poe2",
    cardName: string,
    page: number = 1,
    pageSize: number = 20,
    league?: string,
    sortColumn?: "date" | "league" | "found" | "duration" | "decks",
    sortDirection?: "asc" | "desc",
  ): Promise<SessionsPageDTO> {
    // Get total count
    const total = await this.repository.getSessionCountByCard(
      game,
      cardName,
      league,
    );
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Get paginated sessions
    const sessions = await this.repository.searchSessionsByCard(
      game,
      cardName,
      pageSize,
      offset,
      league,
      sortColumn,
      sortDirection,
    );

    return {
      sessions,
      total,
      page,
      pageSize,
      totalPages,
    };
  }
}

export type { SessionSummaryDTO, SessionsPageDTO };
export { SessionsService };
