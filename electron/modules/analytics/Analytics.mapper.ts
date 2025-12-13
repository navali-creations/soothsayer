import type {
  CardOccurrenceRatioDTO,
  CardPriceHistoryDTO,
  CardPricePeakDTO,
  CardStatisticDTO,
  LeagueAnalyticsDTO,
  SessionComparisonDTO,
} from "./Analytics.dto";

/**
 * Analytics Mapper
 * Converts DTOs to service-layer types
 */
export class AnalyticsMapper {
  /**
   * Map CardStatisticDTO to service type
   * (Already in the correct format)
   */
  static toCardStatistic(dto: CardStatisticDTO): CardStatistic {
    return {
      cardName: dto.cardName,
      count: dto.count,
      percentage: dto.percentage,
    };
  }

  /**
   * Map CardPricePeakDTO to service type
   * (Already in the correct format)
   */
  static toCardPricePeak(dto: CardPricePeakDTO): CardPricePeak {
    return {
      cardName: dto.cardName,
      maxChaosValue: dto.maxChaosValue,
      maxDivineValue: dto.maxDivineValue,
      peakTimestamp: dto.peakTimestamp,
      daysIntoLeague: dto.daysIntoLeague,
    };
  }

  /**
   * Map CardPriceHistoryDTO to service type
   * (Already in the correct format)
   */
  static toCardPriceHistory(dto: CardPriceHistoryDTO): CardPriceHistory {
    return {
      cardName: dto.cardName,
      timestamp: dto.timestamp,
      chaosValue: dto.chaosValue,
      divineValue: dto.divineValue,
      daysIntoLeague: dto.daysIntoLeague,
    };
  }

  /**
   * Map SessionComparisonDTO to service type
   * (Already in the correct format)
   */
  static toSessionComparison(dto: SessionComparisonDTO): SessionComparison {
    return {
      cardName: dto.cardName,
      session1Count: dto.session1Count,
      session2Count: dto.session2Count,
      difference: dto.difference,
    };
  }

  /**
   * Map CardOccurrenceRatioDTO to service type
   * (Already in the correct format)
   */
  static toCardOccurrenceRatio(
    dto: CardOccurrenceRatioDTO,
  ): CardOccurrenceRatio {
    return {
      cardName: dto.cardName,
      count: dto.count,
      ratio: dto.ratio,
      percentage: dto.percentage,
    };
  }

  /**
   * Map LeagueAnalyticsDTO to service type
   * (Already in the correct format)
   */
  static toLeagueAnalytics(dto: LeagueAnalyticsDTO): LeagueAnalytics {
    return {
      leagueName: dto.leagueName,
      totalCards: dto.totalCards,
      uniqueCards: dto.uniqueCards,
      mostCommon: dto.mostCommon,
      highestValue: dto.highestValue,
      sessionCount: dto.sessionCount,
    };
  }
}

// Service-layer types (match existing interfaces)
export interface CardStatistic {
  cardName: string;
  count: number;
  percentage: number;
}

export interface CardPricePeak {
  cardName: string;
  maxChaosValue: number;
  maxDivineValue: number;
  peakTimestamp: string;
  daysIntoLeague: number;
}

export interface CardPriceHistory {
  cardName: string;
  timestamp: string;
  chaosValue: number;
  divineValue: number;
  daysIntoLeague: number;
}

export interface SessionComparison {
  cardName: string;
  session1Count: number;
  session2Count: number;
  difference: number;
}

export interface CardOccurrenceRatio {
  cardName: string;
  count: number;
  ratio: number;
  percentage: number;
}

export interface LeagueAnalytics {
  leagueName: string;
  totalCards: number;
  uniqueCards: number;
  mostCommon: CardStatistic[];
  highestValue: CardPricePeak[];
  sessionCount: number;
}
