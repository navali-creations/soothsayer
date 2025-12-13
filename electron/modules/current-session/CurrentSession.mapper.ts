import type {
  SessionsTable,
  SessionCardsTable,
  SessionSummariesTable,
} from "../database/Database.types";
import type { GameType } from "../../../types/data-stores";
import type {
  SessionDTO,
  SessionCardDTO,
  SessionSummaryDTO,
} from "./CurrentSession.dto";

/**
 * Mappers convert between database rows and DTOs
 * Handles type conversions (e.g., number <-> boolean, string -> GameType)
 */
export class CurrentSessionMapper {
  /**
   * Convert database session row to DTO
   */
  static toSessionDTO(row: SessionsTable): SessionDTO {
    return {
      id: row.id,
      game: row.game as GameType,
      leagueId: row.league_id,
      snapshotId: row.snapshot_id,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      totalCount: row.total_count,
      isActive: row.is_active === 1,
    };
  }

  /**
   * Convert database session card row to DTO
   */
  static toSessionCardDTO(row: SessionCardsTable): SessionCardDTO {
    return {
      cardName: row.card_name,
      count: row.count,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      hidePriceExchange: row.hide_price_exchange === 1,
      hidePriceStash: row.hide_price_stash === 1,
    };
  }

  /**
   * Convert database session summary row to DTO
   */
  static toSessionSummaryDTO(row: SessionSummariesTable): SessionSummaryDTO {
    return {
      sessionId: row.session_id,
      game: row.game as GameType,
      league: row.league,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMinutes: row.duration_minutes,
      totalDecksOpened: row.total_decks_opened,
      totalExchangeValue: row.total_exchange_value,
      totalStashValue: row.total_stash_value,
      exchangeChaosToDivine: row.exchange_chaos_to_divine,
      stashChaosToDivine: row.stash_chaos_to_divine,
    };
  }

  /**
   * Convert boolean to SQLite number (0 or 1)
   */
  static boolToDb(value: boolean | undefined): number | undefined {
    return value === undefined ? undefined : value ? 1 : 0;
  }

  /**
   * Convert SQLite number to boolean
   */
  static dbToBool(value: number): boolean {
    return value === 1;
  }
}
