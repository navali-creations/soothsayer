import { describe, expect, it } from "vitest";

import type { CardPriceHistoryPointDTO } from "../CardDetails.dto";
import {
  CardDetailsMapper,
  computePriceChanges,
  type PoeNinjaDetailsResponse,
} from "../CardDetails.mapper";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const BASE_TIMESTAMP = "2026-03-01T00:00:00Z";

function makeTimestamp(daysOffset: number): string {
  const date = new Date(BASE_TIMESTAMP);
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString();
}

function makePoeNinjaResponse(
  overrides: Partial<PoeNinjaDetailsResponse> = {},
): PoeNinjaDetailsResponse {
  return {
    item: {
      id: "house-of-mirrors",
      name: "House of Mirrors",
      category: "Cards",
      detailsId: "house-of-mirrors",
    },
    pairs: [
      {
        id: "chaos",
        volumePrimaryValue: 0,
        history: [],
      },
      {
        id: "divine",
        rate: 300.4,
        volumePrimaryValue: 8836081,
        history: [
          {
            timestamp: makeTimestamp(-30),
            rate: 280.0,
            volumePrimaryValue: 7000000,
          },
          {
            timestamp: makeTimestamp(-7),
            rate: 290.0,
            volumePrimaryValue: 8000000,
          },
          {
            timestamp: makeTimestamp(-1),
            rate: 295.0,
            volumePrimaryValue: 8500000,
          },
          {
            timestamp: makeTimestamp(0),
            rate: 300.4,
            volumePrimaryValue: 8836081,
          },
        ],
      },
    ],
    core: {
      items: [
        {
          id: "chaos",
          name: "Chaos Orb",
          image: "chaos.png",
          category: "Currency",
          detailsId: "chaos-orb",
        },
        {
          id: "divine",
          name: "Divine Orb",
          image: "divine.png",
          category: "Currency",
          detailsId: "divine-orb",
        },
      ],
      rates: { divine: 0.001235 },
      primary: "chaos",
      secondary: "divine",
    },
    ...overrides,
  };
}

// ─── computePriceChanges ─────────────────────────────────────────────────────

describe("computePriceChanges", () => {
  it("should return empty object for empty history", () => {
    const result = computePriceChanges([]);
    expect(result).toEqual({});
  });

  it("should return empty object for single data point", () => {
    const result = computePriceChanges([
      { timestamp: makeTimestamp(0), rate: 100, volume: 5000 },
    ]);
    expect(result).toEqual({});
  });

  it("should compute 24h change when history has two points ~1 day apart", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-1), rate: 100, volume: 5000 },
      { timestamp: makeTimestamp(0), rate: 110, volume: 5500 },
    ];
    const result = computePriceChanges(history);

    expect(result.change24h).toBeDefined();
    expect(result.change24h).toBeCloseTo(10.0, 0);
  });

  it("should compute negative 24h change", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-1), rate: 100, volume: 5000 },
      { timestamp: makeTimestamp(0), rate: 88, volume: 4000 },
    ];
    const result = computePriceChanges(history);

    expect(result.change24h).toBeDefined();
    expect(result.change24h).toBeCloseTo(-12.0, 0);
  });

  it("should compute all three periods when enough history exists", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-31), rate: 200, volume: 5000 },
      { timestamp: makeTimestamp(-30), rate: 210, volume: 5100 },
      { timestamp: makeTimestamp(-7), rate: 250, volume: 6000 },
      { timestamp: makeTimestamp(-1), rate: 280, volume: 7000 },
      { timestamp: makeTimestamp(0), rate: 300, volume: 8000 },
    ];
    const result = computePriceChanges(history);

    expect(result.change24h).toBeDefined();
    expect(result.change7d).toBeDefined();
    expect(result.change30d).toBeDefined();

    // 24h: (300 - 280) / 280 * 100 = ~7.1%
    expect(result.change24h).toBeCloseTo(7.1, 0);

    // 7d: (300 - 250) / 250 * 100 = 20%
    expect(result.change7d).toBeCloseTo(20.0, 0);

    // 30d: (300 - 210) / 210 * 100 ≈ 42.9%
    expect(result.change30d).toBeCloseTo(42.9, 0);
  });

  it("should omit periods where no close-enough data point exists", () => {
    // Only 2 days of history — 7d and 30d should be omitted
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-1), rate: 100, volume: 5000 },
      { timestamp: makeTimestamp(0), rate: 105, volume: 5200 },
    ];
    const result = computePriceChanges(history);

    expect(result.change24h).toBeDefined();
    expect(result.change7d).toBeUndefined();
    expect(result.change30d).toBeUndefined();
  });

  it("should return zero change when rate is unchanged", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-1), rate: 100, volume: 5000 },
      { timestamp: makeTimestamp(0), rate: 100, volume: 5000 },
    ];
    const result = computePriceChanges(history);

    expect(result.change24h).toBe(0);
  });

  it("should skip lookback period if closest point has zero rate", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-1), rate: 0, volume: 0 },
      { timestamp: makeTimestamp(0), rate: 100, volume: 5000 },
    ];
    const result = computePriceChanges(history);

    // Division by zero guard: should not produce a change24h
    expect(result.change24h).toBeUndefined();
  });

  it("should round to 1 decimal place", () => {
    const history: CardPriceHistoryPointDTO[] = [
      { timestamp: makeTimestamp(-1), rate: 300, volume: 5000 },
      { timestamp: makeTimestamp(0), rate: 301, volume: 5100 },
    ];
    const result = computePriceChanges(history);

    // (301 - 300) / 300 * 100 = 0.3333...% → rounds to 0.3
    expect(result.change24h).toBe(0.3);
  });
});

// ─── CardDetailsMapper.toDTO ─────────────────────────────────────────────────

describe("CardDetailsMapper.toDTO", () => {
  const CARD_NAME = "House of Mirrors";
  const DETAILS_ID = "house-of-mirrors";
  const GAME = "poe1" as const;
  const LEAGUE = "Settlers";
  const FETCHED_AT = "2026-03-05T12:00:00Z";

  it("should map a full poe.ninja response to DTO (happy path)", () => {
    const raw = makePoeNinjaResponse();
    const dto = CardDetailsMapper.toDTO(
      raw,
      CARD_NAME,
      DETAILS_ID,
      GAME,
      LEAGUE,
      FETCHED_AT,
      false,
    );

    expect(dto.cardName).toBe(CARD_NAME);
    expect(dto.detailsId).toBe(DETAILS_ID);
    expect(dto.game).toBe(GAME);
    expect(dto.league).toBe(LEAGUE);
    expect(dto.currentDivineRate).toBe(300.4);
    expect(dto.currentVolume).toBe(8836081);
    expect(dto.chaosToDivineRatio).toBe(0.001235);
    expect(dto.priceHistory).toHaveLength(4);
    expect(dto.fetchedAt).toBe(FETCHED_AT);
    expect(dto.isFromCache).toBe(false);
  });

  it("should map price history points correctly", () => {
    const raw = makePoeNinjaResponse();
    const dto = CardDetailsMapper.toDTO(
      raw,
      CARD_NAME,
      DETAILS_ID,
      GAME,
      LEAGUE,
      FETCHED_AT,
      false,
    );

    const firstPoint = dto.priceHistory[0];
    expect(firstPoint.timestamp).toBe(makeTimestamp(-30));
    expect(firstPoint.rate).toBe(280.0);
    expect(firstPoint.volume).toBe(7000000);
  });

  it("should set isFromCache flag correctly", () => {
    const raw = makePoeNinjaResponse();

    const freshDto = CardDetailsMapper.toDTO(
      raw,
      CARD_NAME,
      DETAILS_ID,
      GAME,
      LEAGUE,
      FETCHED_AT,
      false,
    );
    expect(freshDto.isFromCache).toBe(false);

    const cachedDto = CardDetailsMapper.toDTO(
      raw,
      CARD_NAME,
      DETAILS_ID,
      GAME,
      LEAGUE,
      FETCHED_AT,
      true,
    );
    expect(cachedDto.isFromCache).toBe(true);
  });

  it("should compute price changes from history", () => {
    const raw = makePoeNinjaResponse();
    const dto = CardDetailsMapper.toDTO(
      raw,
      CARD_NAME,
      DETAILS_ID,
      GAME,
      LEAGUE,
      FETCHED_AT,
      false,
    );

    // With 4 data points spanning 30 days, we should get some changes
    expect(dto.priceChanges).toBeDefined();
    expect(dto.priceChanges.change24h).toBeDefined();
  });

  // ─── Missing "divine" pair ───────────────────────────────────────────────

  describe("missing divine pair", () => {
    it("should return null rate and empty history when divine pair is absent", () => {
      const raw = makePoeNinjaResponse({
        pairs: [
          { id: "chaos", volumePrimaryValue: 0, history: [] },
          // No "divine" pair
        ],
      });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.currentDivineRate).toBeNull();
      expect(dto.currentVolume).toBeNull();
      expect(dto.priceHistory).toEqual([]);
    });

    it("should return null rate when pairs array is undefined", () => {
      const raw = makePoeNinjaResponse({ pairs: undefined });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.currentDivineRate).toBeNull();
      expect(dto.currentVolume).toBeNull();
      expect(dto.priceHistory).toEqual([]);
    });

    it("should return null rate when pairs array is empty", () => {
      const raw = makePoeNinjaResponse({ pairs: [] });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.currentDivineRate).toBeNull();
      expect(dto.priceHistory).toEqual([]);
    });
  });

  // ─── Empty history ───────────────────────────────────────────────────────

  describe("empty history", () => {
    it("should handle divine pair with empty history array", () => {
      const raw = makePoeNinjaResponse({
        pairs: [
          { id: "chaos", volumePrimaryValue: 0, history: [] },
          {
            id: "divine",
            rate: 100.0,
            volumePrimaryValue: 5000,
            history: [],
          },
        ],
      });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.currentDivineRate).toBe(100.0);
      expect(dto.currentVolume).toBe(5000);
      expect(dto.priceHistory).toEqual([]);
      expect(dto.priceChanges).toEqual({});
    });

    it("should handle divine pair with undefined history", () => {
      const raw = makePoeNinjaResponse({
        pairs: [
          { id: "chaos" },
          {
            id: "divine",
            rate: 50.0,
            volumePrimaryValue: 2000,
            // history: undefined (implicitly)
          },
        ],
      });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.currentDivineRate).toBe(50.0);
      expect(dto.priceHistory).toEqual([]);
    });
  });

  // ─── Missing core.rates ──────────────────────────────────────────────────

  describe("missing core.rates", () => {
    it("should default chaosToDivineRatio to 0 when core is undefined", () => {
      const raw = makePoeNinjaResponse({ core: undefined });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.chaosToDivineRatio).toBe(0);
    });

    it("should default chaosToDivineRatio to 0 when core.rates is undefined", () => {
      const raw = makePoeNinjaResponse({
        core: {
          items: [],
          primary: "chaos",
          secondary: "divine",
          // rates: undefined
        },
      });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.chaosToDivineRatio).toBe(0);
    });

    it("should default chaosToDivineRatio to 0 when divine rate is missing from core.rates", () => {
      const raw = makePoeNinjaResponse({
        core: {
          items: [],
          rates: { chaos: 1 }, // No "divine" key
          primary: "chaos",
          secondary: "divine",
        },
      });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.chaosToDivineRatio).toBe(0);
    });
  });

  // ─── Malformed / minimal response ────────────────────────────────────────

  describe("malformed response", () => {
    it("should handle completely empty response", () => {
      const raw: PoeNinjaDetailsResponse = {};

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.cardName).toBe(CARD_NAME);
      expect(dto.detailsId).toBe(DETAILS_ID);
      expect(dto.currentDivineRate).toBeNull();
      expect(dto.currentVolume).toBeNull();
      expect(dto.chaosToDivineRatio).toBe(0);
      expect(dto.priceHistory).toEqual([]);
      expect(dto.priceChanges).toEqual({});
    });

    it("should handle divine pair with rate but no volumePrimaryValue", () => {
      const raw = makePoeNinjaResponse({
        pairs: [
          {
            id: "divine",
            rate: 42.0,
            // volumePrimaryValue: undefined
            history: [],
          },
        ],
      });

      const dto = CardDetailsMapper.toDTO(
        raw,
        CARD_NAME,
        DETAILS_ID,
        GAME,
        LEAGUE,
        FETCHED_AT,
        false,
      );

      expect(dto.currentDivineRate).toBe(42.0);
      expect(dto.currentVolume).toBeNull();
    });

    it("should work with poe2 game type", () => {
      const raw = makePoeNinjaResponse();
      const dto = CardDetailsMapper.toDTO(
        raw,
        "Test Card",
        "test-card",
        "poe2",
        "TestLeague",
        FETCHED_AT,
        false,
      );

      expect(dto.game).toBe("poe2");
      expect(dto.league).toBe("TestLeague");
      expect(dto.cardName).toBe("Test Card");
      expect(dto.detailsId).toBe("test-card");
    });
  });
});
