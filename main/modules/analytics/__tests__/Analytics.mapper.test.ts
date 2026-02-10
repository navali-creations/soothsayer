import { describe, expect, it } from "vitest";

import type {
  CardOccurrenceRatioDTO,
  CardPriceHistoryDTO,
  CardPricePeakDTO,
  CardStatisticDTO,
  LeagueAnalyticsDTO,
  SessionComparisonDTO,
} from "../Analytics.dto";
import { AnalyticsMapper } from "../Analytics.mapper";

// ─── Factories ─────────────────────────────────────────────────────────────────

function createCardStatisticDTO(
  overrides: Partial<CardStatisticDTO> = {},
): CardStatisticDTO {
  return {
    cardName: "Rain of Chaos",
    count: 42,
    percentage: 12.5,
    ...overrides,
  };
}

function createCardPricePeakDTO(
  overrides: Partial<CardPricePeakDTO> = {},
): CardPricePeakDTO {
  return {
    cardName: "The Doctor",
    maxChaosValue: 90000,
    maxDivineValue: 450,
    peakTimestamp: "2025-02-15T18:30:00Z",
    daysIntoLeague: 45,
    ...overrides,
  };
}

function createCardPriceHistoryDTO(
  overrides: Partial<CardPriceHistoryDTO> = {},
): CardPriceHistoryDTO {
  return {
    cardName: "The Doctor",
    timestamp: "2025-02-10T12:00:00Z",
    chaosValue: 85000,
    divineValue: 425,
    daysIntoLeague: 40,
    ...overrides,
  };
}

function createSessionComparisonDTO(
  overrides: Partial<SessionComparisonDTO> = {},
): SessionComparisonDTO {
  return {
    cardName: "Rain of Chaos",
    session1Count: 10,
    session2Count: 15,
    difference: 5,
    ...overrides,
  };
}

function createCardOccurrenceRatioDTO(
  overrides: Partial<CardOccurrenceRatioDTO> = {},
): CardOccurrenceRatioDTO {
  return {
    cardName: "Rain of Chaos",
    count: 42,
    ratio: 0.125,
    percentage: 12.5,
    ...overrides,
  };
}

function createLeagueAnalyticsDTO(
  overrides: Partial<LeagueAnalyticsDTO> = {},
): LeagueAnalyticsDTO {
  return {
    leagueName: "Settlers",
    totalCards: 5000,
    uniqueCards: 230,
    mostCommon: [createCardStatisticDTO()],
    highestValue: [createCardPricePeakDTO()],
    sessionCount: 15,
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Analytics.mapper", () => {
  // ─── toCardStatistic ───────────────────────────────────────────────────

  describe("toCardStatistic", () => {
    it("should map all fields correctly", () => {
      const dto = createCardStatisticDTO();
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(result.cardName).toBe("Rain of Chaos");
      expect(result.count).toBe(42);
      expect(result.percentage).toBe(12.5);
    });

    it("should produce a result with the correct set of keys", () => {
      const dto = createCardStatisticDTO();
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(Object.keys(result).sort()).toEqual(
        ["cardName", "count", "percentage"].sort(),
      );
    });

    it("should handle zero count and percentage", () => {
      const dto = createCardStatisticDTO({ count: 0, percentage: 0 });
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(result.count).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("should handle fractional percentage", () => {
      const dto = createCardStatisticDTO({ percentage: 0.0023 });
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(result.percentage).toBe(0.0023);
    });

    it("should handle 100% percentage", () => {
      const dto = createCardStatisticDTO({ percentage: 100 });
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(result.percentage).toBe(100);
    });

    it("should handle large count values", () => {
      const dto = createCardStatisticDTO({ count: 999999 });
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(result.count).toBe(999999);
    });

    it("should handle card names with special characters", () => {
      const dto = createCardStatisticDTO({ cardName: "The King's Heart" });
      const result = AnalyticsMapper.toCardStatistic(dto);

      expect(result.cardName).toBe("The King's Heart");
    });

    it("should correctly map an array of DTOs using Array.map", () => {
      const dtos = [
        createCardStatisticDTO({ cardName: "Rain of Chaos", count: 100 }),
        createCardStatisticDTO({ cardName: "The Doctor", count: 2 }),
        createCardStatisticDTO({ cardName: "The Fiend", count: 1 }),
      ];

      const results = dtos.map(AnalyticsMapper.toCardStatistic);

      expect(results).toHaveLength(3);
      expect(results[0].cardName).toBe("Rain of Chaos");
      expect(results[0].count).toBe(100);
      expect(results[1].cardName).toBe("The Doctor");
      expect(results[2].cardName).toBe("The Fiend");
    });

    it("should produce independent objects for each mapping", () => {
      const dto = createCardStatisticDTO();
      const result1 = AnalyticsMapper.toCardStatistic(dto);
      const result2 = AnalyticsMapper.toCardStatistic(dto);

      result1.count = 999;
      expect(result2.count).toBe(42);
    });
  });

  // ─── toCardPricePeak ──────────────────────────────────────────────────

  describe("toCardPricePeak", () => {
    it("should map all fields correctly", () => {
      const dto = createCardPricePeakDTO();
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(result.cardName).toBe("The Doctor");
      expect(result.maxChaosValue).toBe(90000);
      expect(result.maxDivineValue).toBe(450);
      expect(result.peakTimestamp).toBe("2025-02-15T18:30:00Z");
      expect(result.daysIntoLeague).toBe(45);
    });

    it("should produce a result with the correct set of keys", () => {
      const dto = createCardPricePeakDTO();
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(Object.keys(result).sort()).toEqual(
        [
          "cardName",
          "maxChaosValue",
          "maxDivineValue",
          "peakTimestamp",
          "daysIntoLeague",
        ].sort(),
      );
    });

    it("should handle zero values", () => {
      const dto = createCardPricePeakDTO({
        maxChaosValue: 0,
        maxDivineValue: 0,
        daysIntoLeague: 0,
      });
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(result.maxChaosValue).toBe(0);
      expect(result.maxDivineValue).toBe(0);
      expect(result.daysIntoLeague).toBe(0);
    });

    it("should handle fractional price values", () => {
      const dto = createCardPricePeakDTO({
        maxChaosValue: 0.5,
        maxDivineValue: 0.0025,
      });
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(result.maxChaosValue).toBe(0.5);
      expect(result.maxDivineValue).toBe(0.0025);
    });

    it("should handle very large chaos values", () => {
      const dto = createCardPricePeakDTO({ maxChaosValue: 5000000 });
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(result.maxChaosValue).toBe(5000000);
    });

    it("should handle day 1 of a league", () => {
      const dto = createCardPricePeakDTO({ daysIntoLeague: 1 });
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(result.daysIntoLeague).toBe(1);
    });

    it("should handle late-league peaks", () => {
      const dto = createCardPricePeakDTO({ daysIntoLeague: 90 });
      const result = AnalyticsMapper.toCardPricePeak(dto);

      expect(result.daysIntoLeague).toBe(90);
    });

    it("should correctly map an array of DTOs using Array.map", () => {
      const dtos = [
        createCardPricePeakDTO({
          cardName: "The Doctor",
          maxChaosValue: 90000,
        }),
        createCardPricePeakDTO({
          cardName: "The Fiend",
          maxChaosValue: 120000,
        }),
      ];

      const results = dtos.map(AnalyticsMapper.toCardPricePeak);

      expect(results).toHaveLength(2);
      expect(results[0].cardName).toBe("The Doctor");
      expect(results[1].maxChaosValue).toBe(120000);
    });
  });

  // ─── toCardPriceHistory ───────────────────────────────────────────────

  describe("toCardPriceHistory", () => {
    it("should map all fields correctly", () => {
      const dto = createCardPriceHistoryDTO();
      const result = AnalyticsMapper.toCardPriceHistory(dto);

      expect(result.cardName).toBe("The Doctor");
      expect(result.timestamp).toBe("2025-02-10T12:00:00Z");
      expect(result.chaosValue).toBe(85000);
      expect(result.divineValue).toBe(425);
      expect(result.daysIntoLeague).toBe(40);
    });

    it("should produce a result with the correct set of keys", () => {
      const dto = createCardPriceHistoryDTO();
      const result = AnalyticsMapper.toCardPriceHistory(dto);

      expect(Object.keys(result).sort()).toEqual(
        [
          "cardName",
          "timestamp",
          "chaosValue",
          "divineValue",
          "daysIntoLeague",
        ].sort(),
      );
    });

    it("should handle zero price values", () => {
      const dto = createCardPriceHistoryDTO({
        chaosValue: 0,
        divineValue: 0,
      });
      const result = AnalyticsMapper.toCardPriceHistory(dto);

      expect(result.chaosValue).toBe(0);
      expect(result.divineValue).toBe(0);
    });

    it("should handle fractional divine values", () => {
      const dto = createCardPriceHistoryDTO({ divineValue: 0.003 });
      const result = AnalyticsMapper.toCardPriceHistory(dto);

      expect(result.divineValue).toBe(0.003);
    });

    it("should preserve ISO timestamp format", () => {
      const timestamp = "2025-06-15T23:59:59.999Z";
      const dto = createCardPriceHistoryDTO({ timestamp });
      const result = AnalyticsMapper.toCardPriceHistory(dto);

      expect(result.timestamp).toBe(timestamp);
    });

    it("should handle day zero of a league", () => {
      const dto = createCardPriceHistoryDTO({ daysIntoLeague: 0 });
      const result = AnalyticsMapper.toCardPriceHistory(dto);

      expect(result.daysIntoLeague).toBe(0);
    });

    it("should correctly map an array to build a price timeline", () => {
      const dtos = [
        createCardPriceHistoryDTO({
          timestamp: "2025-01-01T00:00:00Z",
          chaosValue: 80000,
          daysIntoLeague: 0,
        }),
        createCardPriceHistoryDTO({
          timestamp: "2025-01-15T00:00:00Z",
          chaosValue: 85000,
          daysIntoLeague: 14,
        }),
        createCardPriceHistoryDTO({
          timestamp: "2025-02-01T00:00:00Z",
          chaosValue: 90000,
          daysIntoLeague: 31,
        }),
      ];

      const results = dtos.map(AnalyticsMapper.toCardPriceHistory);

      expect(results).toHaveLength(3);
      expect(results[0].chaosValue).toBe(80000);
      expect(results[1].chaosValue).toBe(85000);
      expect(results[2].chaosValue).toBe(90000);
    });

    it("should handle empty array", () => {
      const dtos: CardPriceHistoryDTO[] = [];
      const results = dtos.map(AnalyticsMapper.toCardPriceHistory);

      expect(results).toEqual([]);
    });
  });

  // ─── toSessionComparison ──────────────────────────────────────────────

  describe("toSessionComparison", () => {
    it("should map all fields correctly", () => {
      const dto = createSessionComparisonDTO();
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(result.cardName).toBe("Rain of Chaos");
      expect(result.session1Count).toBe(10);
      expect(result.session2Count).toBe(15);
      expect(result.difference).toBe(5);
    });

    it("should produce a result with the correct set of keys", () => {
      const dto = createSessionComparisonDTO();
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(Object.keys(result).sort()).toEqual(
        ["cardName", "session1Count", "session2Count", "difference"].sort(),
      );
    });

    it("should handle zero counts", () => {
      const dto = createSessionComparisonDTO({
        session1Count: 0,
        session2Count: 0,
        difference: 0,
      });
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(result.session1Count).toBe(0);
      expect(result.session2Count).toBe(0);
      expect(result.difference).toBe(0);
    });

    it("should handle negative difference (session2 has fewer)", () => {
      const dto = createSessionComparisonDTO({
        session1Count: 20,
        session2Count: 5,
        difference: -15,
      });
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(result.difference).toBe(-15);
    });

    it("should handle card present only in session 1", () => {
      const dto = createSessionComparisonDTO({
        session1Count: 7,
        session2Count: 0,
        difference: -7,
      });
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(result.session1Count).toBe(7);
      expect(result.session2Count).toBe(0);
      expect(result.difference).toBe(-7);
    });

    it("should handle card present only in session 2", () => {
      const dto = createSessionComparisonDTO({
        session1Count: 0,
        session2Count: 3,
        difference: 3,
      });
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(result.session1Count).toBe(0);
      expect(result.session2Count).toBe(3);
      expect(result.difference).toBe(3);
    });

    it("should handle equal counts", () => {
      const dto = createSessionComparisonDTO({
        session1Count: 50,
        session2Count: 50,
        difference: 0,
      });
      const result = AnalyticsMapper.toSessionComparison(dto);

      expect(result.difference).toBe(0);
    });

    it("should correctly map an array of comparison DTOs", () => {
      const dtos = [
        createSessionComparisonDTO({
          cardName: "Rain of Chaos",
          difference: 5,
        }),
        createSessionComparisonDTO({ cardName: "The Doctor", difference: -1 }),
        createSessionComparisonDTO({ cardName: "The Fiend", difference: 0 }),
      ];

      const results = dtos.map(AnalyticsMapper.toSessionComparison);

      expect(results).toHaveLength(3);
      expect(results[0].difference).toBe(5);
      expect(results[1].difference).toBe(-1);
      expect(results[2].difference).toBe(0);
    });
  });

  // ─── toCardOccurrenceRatio ────────────────────────────────────────────

  describe("toCardOccurrenceRatio", () => {
    it("should map all fields correctly", () => {
      const dto = createCardOccurrenceRatioDTO();
      const result = AnalyticsMapper.toCardOccurrenceRatio(dto);

      expect(result.cardName).toBe("Rain of Chaos");
      expect(result.count).toBe(42);
      expect(result.ratio).toBe(0.125);
      expect(result.percentage).toBe(12.5);
    });

    it("should produce a result with the correct set of keys", () => {
      const dto = createCardOccurrenceRatioDTO();
      const result = AnalyticsMapper.toCardOccurrenceRatio(dto);

      expect(Object.keys(result).sort()).toEqual(
        ["cardName", "count", "ratio", "percentage"].sort(),
      );
    });

    it("should handle zero ratio and percentage", () => {
      const dto = createCardOccurrenceRatioDTO({
        count: 0,
        ratio: 0,
        percentage: 0,
      });
      const result = AnalyticsMapper.toCardOccurrenceRatio(dto);

      expect(result.count).toBe(0);
      expect(result.ratio).toBe(0);
      expect(result.percentage).toBe(0);
    });

    it("should handle very small ratios for rare cards", () => {
      const dto = createCardOccurrenceRatioDTO({
        cardName: "The Doctor",
        count: 1,
        ratio: 0.00002,
        percentage: 0.002,
      });
      const result = AnalyticsMapper.toCardOccurrenceRatio(dto);

      expect(result.ratio).toBe(0.00002);
      expect(result.percentage).toBe(0.002);
    });

    it("should handle a card that is 100% of the pool", () => {
      const dto = createCardOccurrenceRatioDTO({
        ratio: 1.0,
        percentage: 100,
      });
      const result = AnalyticsMapper.toCardOccurrenceRatio(dto);

      expect(result.ratio).toBe(1.0);
      expect(result.percentage).toBe(100);
    });

    it("should correctly map an array of occurrence ratios", () => {
      const dtos = [
        createCardOccurrenceRatioDTO({ cardName: "Rain of Chaos", ratio: 0.4 }),
        createCardOccurrenceRatioDTO({ cardName: "Her Mask", ratio: 0.3 }),
        createCardOccurrenceRatioDTO({ cardName: "The Doctor", ratio: 0.001 }),
      ];

      const results = dtos.map(AnalyticsMapper.toCardOccurrenceRatio);

      expect(results).toHaveLength(3);
      expect(results[0].ratio).toBe(0.4);
      expect(results[1].ratio).toBe(0.3);
      expect(results[2].ratio).toBe(0.001);
    });
  });

  // ─── toLeagueAnalytics ────────────────────────────────────────────────

  describe("toLeagueAnalytics", () => {
    it("should map all top-level fields correctly", () => {
      const dto = createLeagueAnalyticsDTO();
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.leagueName).toBe("Settlers");
      expect(result.totalCards).toBe(5000);
      expect(result.uniqueCards).toBe(230);
      expect(result.sessionCount).toBe(15);
    });

    it("should produce a result with the correct set of keys", () => {
      const dto = createLeagueAnalyticsDTO();
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(Object.keys(result).sort()).toEqual(
        [
          "leagueName",
          "totalCards",
          "uniqueCards",
          "mostCommon",
          "highestValue",
          "sessionCount",
        ].sort(),
      );
    });

    it("should pass through mostCommon array", () => {
      const mostCommon = [
        createCardStatisticDTO({ cardName: "Rain of Chaos", count: 200 }),
        createCardStatisticDTO({ cardName: "Her Mask", count: 150 }),
      ];
      const dto = createLeagueAnalyticsDTO({ mostCommon });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.mostCommon).toHaveLength(2);
      expect(result.mostCommon[0].cardName).toBe("Rain of Chaos");
      expect(result.mostCommon[0].count).toBe(200);
      expect(result.mostCommon[1].cardName).toBe("Her Mask");
      expect(result.mostCommon[1].count).toBe(150);
    });

    it("should pass through highestValue array", () => {
      const highestValue = [
        createCardPricePeakDTO({
          cardName: "The Doctor",
          maxChaosValue: 90000,
        }),
        createCardPricePeakDTO({
          cardName: "The Fiend",
          maxChaosValue: 120000,
        }),
      ];
      const dto = createLeagueAnalyticsDTO({ highestValue });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.highestValue).toHaveLength(2);
      expect(result.highestValue[0].cardName).toBe("The Doctor");
      expect(result.highestValue[1].maxChaosValue).toBe(120000);
    });

    it("should handle empty mostCommon array", () => {
      const dto = createLeagueAnalyticsDTO({ mostCommon: [] });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.mostCommon).toEqual([]);
    });

    it("should handle empty highestValue array", () => {
      const dto = createLeagueAnalyticsDTO({ highestValue: [] });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.highestValue).toEqual([]);
    });

    it("should handle zero totals for a new league", () => {
      const dto = createLeagueAnalyticsDTO({
        totalCards: 0,
        uniqueCards: 0,
        sessionCount: 0,
        mostCommon: [],
        highestValue: [],
      });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.totalCards).toBe(0);
      expect(result.uniqueCards).toBe(0);
      expect(result.sessionCount).toBe(0);
      expect(result.mostCommon).toEqual([]);
      expect(result.highestValue).toEqual([]);
    });

    it("should handle large card counts", () => {
      const dto = createLeagueAnalyticsDTO({
        totalCards: 1000000,
        uniqueCards: 400,
        sessionCount: 500,
      });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.totalCards).toBe(1000000);
      expect(result.uniqueCards).toBe(400);
      expect(result.sessionCount).toBe(500);
    });

    it("should handle poe2 league names", () => {
      const dto = createLeagueAnalyticsDTO({ leagueName: "Dawn" });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.leagueName).toBe("Dawn");
    });

    it("should handle league names with spaces", () => {
      const dto = createLeagueAnalyticsDTO({
        leagueName: "Settlers of Kalguur",
      });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.leagueName).toBe("Settlers of Kalguur");
    });

    it("should handle Standard league", () => {
      const dto = createLeagueAnalyticsDTO({ leagueName: "Standard" });
      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.leagueName).toBe("Standard");
    });
  });

  // ─── Realistic Scenarios ─────────────────────────────────────────────

  describe("realistic scenarios", () => {
    it("should map a full league analytics response with nested data", () => {
      const dto = createLeagueAnalyticsDTO({
        leagueName: "Settlers",
        totalCards: 50000,
        uniqueCards: 280,
        sessionCount: 42,
        mostCommon: [
          createCardStatisticDTO({
            cardName: "Rain of Chaos",
            count: 8500,
            percentage: 17,
          }),
          createCardStatisticDTO({
            cardName: "Her Mask",
            count: 6200,
            percentage: 12.4,
          }),
          createCardStatisticDTO({
            cardName: "Destined to Crumble",
            count: 5100,
            percentage: 10.2,
          }),
        ],
        highestValue: [
          createCardPricePeakDTO({
            cardName: "The Fiend",
            maxChaosValue: 120000,
            maxDivineValue: 600,
            daysIntoLeague: 12,
          }),
          createCardPricePeakDTO({
            cardName: "The Doctor",
            maxChaosValue: 90000,
            maxDivineValue: 450,
            daysIntoLeague: 5,
          }),
        ],
      });

      const result = AnalyticsMapper.toLeagueAnalytics(dto);

      expect(result.leagueName).toBe("Settlers");
      expect(result.totalCards).toBe(50000);
      expect(result.uniqueCards).toBe(280);
      expect(result.sessionCount).toBe(42);
      expect(result.mostCommon).toHaveLength(3);
      expect(result.mostCommon[0].cardName).toBe("Rain of Chaos");
      expect(result.mostCommon[2].percentage).toBe(10.2);
      expect(result.highestValue).toHaveLength(2);
      expect(result.highestValue[0].maxChaosValue).toBe(120000);
      expect(result.highestValue[1].daysIntoLeague).toBe(5);
    });

    it("should build a complete price history timeline", () => {
      const timestamps = [
        "2025-01-01T00:00:00Z",
        "2025-01-08T00:00:00Z",
        "2025-01-15T00:00:00Z",
        "2025-01-22T00:00:00Z",
        "2025-01-29T00:00:00Z",
      ];
      const prices = [80000, 85000, 92000, 88000, 90000];

      const dtos: CardPriceHistoryDTO[] = timestamps.map((ts, i) =>
        createCardPriceHistoryDTO({
          timestamp: ts,
          chaosValue: prices[i],
          daysIntoLeague: i * 7,
        }),
      );

      const results = dtos.map(AnalyticsMapper.toCardPriceHistory);

      expect(results).toHaveLength(5);
      expect(results[0].daysIntoLeague).toBe(0);
      expect(results[2].chaosValue).toBe(92000);
      expect(results[4].daysIntoLeague).toBe(28);
    });

    it("should compare two sessions with mixed results", () => {
      const dtos: SessionComparisonDTO[] = [
        createSessionComparisonDTO({
          cardName: "Rain of Chaos",
          session1Count: 50,
          session2Count: 80,
          difference: 30,
        }),
        createSessionComparisonDTO({
          cardName: "The Doctor",
          session1Count: 2,
          session2Count: 0,
          difference: -2,
        }),
        createSessionComparisonDTO({
          cardName: "Her Mask",
          session1Count: 30,
          session2Count: 30,
          difference: 0,
        }),
        createSessionComparisonDTO({
          cardName: "House of Mirrors",
          session1Count: 0,
          session2Count: 1,
          difference: 1,
        }),
      ];

      const results = dtos.map(AnalyticsMapper.toSessionComparison);

      expect(results).toHaveLength(4);
      // Gained more
      expect(results[0].difference).toBeGreaterThan(0);
      // Lost
      expect(results[1].difference).toBeLessThan(0);
      // Same
      expect(results[2].difference).toBe(0);
      // New card in session 2
      expect(results[3].session1Count).toBe(0);
      expect(results[3].session2Count).toBe(1);
    });

    it("should build a complete occurrence ratio breakdown", () => {
      const dtos: CardOccurrenceRatioDTO[] = [
        createCardOccurrenceRatioDTO({
          cardName: "Rain of Chaos",
          count: 400,
          ratio: 0.4,
          percentage: 40,
        }),
        createCardOccurrenceRatioDTO({
          cardName: "Her Mask",
          count: 300,
          ratio: 0.3,
          percentage: 30,
        }),
        createCardOccurrenceRatioDTO({
          cardName: "Other Cards",
          count: 300,
          ratio: 0.3,
          percentage: 30,
        }),
      ];

      const results = dtos.map(AnalyticsMapper.toCardOccurrenceRatio);

      expect(results).toHaveLength(3);
      const totalRatio = results.reduce((sum, r) => sum + r.ratio, 0);
      expect(totalRatio).toBeCloseTo(1.0);
      const totalPercentage = results.reduce((sum, r) => sum + r.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100);
    });
  });
});
