import { ipcMain } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { SnapshotService } from "~/main/modules/snapshots";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";

import type { DetailedDivinationCardStats } from "../../../types/data-stores";
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
      ): Promise<SessionsPageDTO> => {
        return this.getAllSessions(game, page, pageSize);
      },
    );

    ipcMain.handle(
      SessionsChannel.GetById,
      async (_event, sessionId: string) => {
        return this.getSessionById(sessionId);
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
      ): Promise<SessionsPageDTO> => {
        return this.searchSessionsByCard(game, cardName, page, pageSize);
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
  ): Promise<SessionsPageDTO> {
    // Get total count
    const total = await this.repository.getSessionCountByCard(game, cardName);
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Get paginated sessions
    const sessions = await this.repository.searchSessionsByCard(
      game,
      cardName,
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
}

export { SessionsService };
export type { SessionSummaryDTO, SessionsPageDTO };
