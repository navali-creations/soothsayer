import { ipcMain } from "electron";
import type { DetailedDivinationCardStats } from "../../../types/data-stores";
import { DatabaseService } from "../database/Database.service";
import { SnapshotService } from "../snapshots/Snapshot.service";
import type { GameVersion } from "../settings-store/SettingsStore.schemas";
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

class SessionsService {
  private static _instance: SessionsService;
  private db: DatabaseService;
  private snapshotService: SnapshotService;

  static getInstance(): SessionsService {
    if (!SessionsService._instance) {
      SessionsService._instance = new SessionsService();
    }
    return SessionsService._instance;
  }

  private constructor() {
    this.db = DatabaseService.getInstance();
    this.snapshotService = SnapshotService.getInstance();
    this.setupHandlers();
  }

  private setupHandlers() {
    ipcMain.handle(
      SessionsChannel.GetAll,
      (
        _event,
        game: GameVersion,
        page: number = 1,
        pageSize: number = 20,
      ): SessionsPage => {
        return this.getAllSessions(game, page, pageSize);
      },
    );

    ipcMain.handle(SessionsChannel.GetById, (_event, sessionId: string) => {
      return this.getSessionById(sessionId);
    });
  }

  /**
   * Get all sessions for a game with pagination
   */
  private getAllSessions(
    game: GameVersion,
    page: number = 1,
    pageSize: number = 20,
  ): SessionsPage {
    const dbInstance = this.db.getDb();

    // Get total count
    const countResult = dbInstance
      .prepare(
        `SELECT COUNT(*) as count
           FROM sessions
           WHERE game = ?`,
      )
      .get(game) as { count: number };

    const total = countResult.count;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Get paginated sessions
    const rows = dbInstance
      .prepare(
        `SELECT
            s.id as sessionId,
            s.game,
            l.name as league,
            s.started_at as startedAt,
            s.ended_at as endedAt,
            ss.duration_minutes as durationMinutes,
            ss.total_decks_opened as totalDecksOpened,
            ss.total_exchange_value as totalExchangeValue,
            ss.total_stash_value as totalStashValue,
            ss.exchange_chaos_to_divine as exchangeChaosToDivine,
            ss.stash_chaos_to_divine as stashChaosToDivine,
            (s.ended_at IS NULL) as isActive
           FROM sessions s
           LEFT JOIN session_summaries ss ON s.id = ss.session_id
           JOIN leagues l ON s.league_id = l.id
           WHERE s.game = ?
           ORDER BY s.started_at DESC
           LIMIT ? OFFSET ?`,
      )
      .all(game, pageSize, offset) as SessionSummary[];

    const sessions = rows.map((row) => ({
      ...row,
      isActive: Boolean(row.isActive),
    }));

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
  public getSessionById(sessionId: string): DetailedDivinationCardStats | null {
    const dbInstance = this.db.getDb();

    // Get session
    const session = dbInstance
      .prepare(
        `SELECT
          s.*,
          l.name as league
         FROM sessions s
         JOIN leagues l ON s.league_id = l.id
         WHERE s.id = ?`,
      )
      .get(sessionId) as any;

    if (!session) return null;

    // Get session cards with hidePrice flags
    const cards = dbInstance
      .prepare(
        `SELECT card_name, count, hide_price_exchange, hide_price_stash
         FROM session_cards
         WHERE session_id = ?`,
      )
      .all(sessionId) as Array<{
      card_name: string;
      count: number;
      hide_price_exchange: number;
      hide_price_stash: number;
    }>;

    // Load snapshot
    const priceSnapshot = session.snapshot_id
      ? this.snapshotService.loadSnapshot(session.snapshot_id) || undefined
      : undefined;

    // Build cards object
    const cardsObject: Record<string, any> = {};

    for (const card of cards) {
      const cardEntry: any = {
        count: card.count,
        processedIds: [],
      };

      // Add prices if snapshot available
      if (priceSnapshot) {
        const exchangeData = priceSnapshot.exchange.cardPrices[card.card_name];
        const stashData = priceSnapshot.stash.cardPrices[card.card_name];

        if (exchangeData) {
          cardEntry.exchangePrice = {
            chaosValue: exchangeData.chaosValue,
            divineValue: exchangeData.divineValue,
            totalValue: exchangeData.chaosValue * card.count,
            hidePrice: Boolean(card.hide_price_exchange),
          };
        }

        if (stashData) {
          cardEntry.stashPrice = {
            chaosValue: stashData.chaosValue,
            divineValue: stashData.divineValue,
            totalValue: stashData.chaosValue * card.count,
            hidePrice: Boolean(card.hide_price_stash),
          };
        }
      }

      cardsObject[card.card_name] = cardEntry;
    }

    // Calculate totals
    let stashTotal = 0;
    let exchangeTotal = 0;

    for (const cardData of Object.values(cardsObject)) {
      if (cardData.stashPrice) {
        stashTotal += cardData.stashPrice.totalValue;
      }
      if (cardData.exchangePrice) {
        exchangeTotal += cardData.exchangePrice.totalValue;
      }
    }

    const totals = priceSnapshot
      ? {
          stash: {
            totalValue: stashTotal,
            chaosToDivineRatio: priceSnapshot.stash.chaosToDivineRatio,
          },
          exchange: {
            totalValue: exchangeTotal,
            chaosToDivineRatio: priceSnapshot.exchange.chaosToDivineRatio,
          },
        }
      : undefined;

    return {
      totalCount: session.total_count,
      cards: cardsObject,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      league: session.league,
      priceSnapshot,
      totals,
    };
  }
}

export { SessionsService };
