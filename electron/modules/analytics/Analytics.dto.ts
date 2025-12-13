/**
 * DTOs for Analytics module
 * These represent the shapes returned from analytics queries
 */

/**
 * Card statistic result from cards table queries
 */
export interface CardStatisticDTO {
  cardName: string;
  count: number;
  percentage: number;
}

/**
 * Card price peak result from snapshot queries
 */
export interface CardPricePeakDTO {
  cardName: string;
  maxChaosValue: number;
  maxDivineValue: number;
  peakTimestamp: string;
  daysIntoLeague: number;
}

/**
 * Card price history point
 */
export interface CardPriceHistoryDTO {
  cardName: string;
  timestamp: string;
  chaosValue: number;
  divineValue: number;
  daysIntoLeague: number;
}

/**
 * League statistics summary
 */
export interface LeagueStatsDTO {
  totalCards: number | null;
  uniqueCards: number | null;
}

/**
 * Session count for a league
 */
export interface LeagueSessionCountDTO {
  count: number;
}

/**
 * Session comparison result
 */
export interface SessionComparisonDTO {
  cardName: string;
  session1Count: number;
  session2Count: number;
  difference: number;
}

/**
 * Card occurrence ratio result
 */
export interface CardOccurrenceRatioDTO {
  cardName: string;
  count: number;
  ratio: number;
  percentage: number;
}

/**
 * Comprehensive league analytics
 */
export interface LeagueAnalyticsDTO {
  leagueName: string;
  totalCards: number;
  uniqueCards: number;
  mostCommon: CardStatisticDTO[];
  highestValue: CardPricePeakDTO[];
  sessionCount: number;
}
