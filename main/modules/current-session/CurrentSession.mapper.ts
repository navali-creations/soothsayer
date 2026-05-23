import type { Selectable } from "kysely";

import type {
  SessionCardEventsRow,
  SessionSummariesTable,
  SessionsRow,
} from "~/main/modules/database";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";

import type { GameType, KnownRarity, Rarity } from "../../../types/data-stores";
import type {
  SessionCardDTO,
  SessionCardEventDTO,
  SessionDTO,
  SessionSummaryDTO,
} from "./CurrentSession.dto";

/**
 * Row type for session card with joined divination card data
 */
interface SessionCardJoinedRow {
  cardName: string;
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  hidePrice: number;
  divinationCardId?: string | null;
  stackSize?: number | null;
  description?: string | null;
  rewardHtml?: string | null;
  artSrc?: string | null;
  flavourHtml?: string | null;
  rarity?: Rarity;
  filterRarity?: KnownRarity | null;
  prohibitedLibraryRarity?: Rarity | null;
}

export type { SessionCardJoinedRow };

/**
 * Mappers convert between database rows and DTOs
 * Handles type conversions (e.g., number <-> boolean, string -> GameType)
 */
export class CurrentSessionMapper {
  /**
   * Convert database session row to DTO
   */
  static toSessionDTO(row: SessionsRow): SessionDTO {
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
   * Handles joined divination card metadata if available
   */
  static toSessionCardDTO(row: SessionCardJoinedRow): SessionCardDTO {
    const dto: SessionCardDTO = {
      cardName: row.cardName,
      count: row.count,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      hidePrice: row.hidePrice === 1,
    };

    // Add divination card metadata if it exists (was joined)
    if (row.divinationCardId) {
      dto.divinationCard = {
        id: row.divinationCardId,
        stackSize: row.stackSize,
        description: row.description,
        rewardHtml: cleanWikiMarkup(row.rewardHtml),
        artSrc: row.artSrc,
        flavourHtml: cleanWikiMarkup(row.flavourHtml),
        rarity: row.rarity,
        filterRarity: row.filterRarity ?? null,
        prohibitedLibraryRarity: row.prohibitedLibraryRarity ?? null,
      };
    }

    return dto;
  }

  /**
   * Convert database session summary row to DTO
   */
  static toSessionSummaryDTO(
    row: Selectable<SessionSummariesTable>,
  ): SessionSummaryDTO {
    return {
      sessionId: row.session_id,
      game: row.game as GameType,
      league: row.league,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMinutes: row.duration_minutes,
      totalDecksOpened: row.total_decks_opened,
      totalValue: row.total_value,
      netProfit: row.net_profit,
      chaosToDivineRatio: row.chaos_to_divine_ratio,
      stackedDeckChaosCost: row.stacked_deck_chaos_cost,
    };
  }

  /**
   * Convert database session card event row to DTO
   */
  static toSessionCardEventDTO(row: SessionCardEventsRow): SessionCardEventDTO {
    return {
      id: row.id,
      sessionId: row.session_id,
      cardName: row.card_name,
      chaosValue: row.chaos_value,
      divineValue: row.divine_value,
      droppedAt: row.dropped_at,
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
