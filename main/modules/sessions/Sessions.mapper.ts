import type { SessionSummaryDTO } from "./Sessions.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class SessionsMapper {
  static toSessionSummaryDTO(row: any): SessionSummaryDTO {
    return {
      sessionId: row.sessionId,
      game: row.game,
      league: row.league,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationMinutes: row.durationMinutes,
      totalDecksOpened: row.totalDecksOpened,
      totalExchangeValue: row.totalExchangeValue,
      totalStashValue: row.totalStashValue,
      totalExchangeNetProfit: row.totalExchangeNetProfit,
      totalStashNetProfit: row.totalStashNetProfit,
      exchangeChaosToDivine: row.exchangeChaosToDivine,
      stashChaosToDivine: row.stashChaosToDivine,
      stackedDeckChaosCost: row.stackedDeckChaosCost,
      isActive: Boolean(row.isActive),
    };
  }
}
