import { describe, expect, it } from "vitest";

import { SessionsMapper } from "../Sessions.mapper";

/**
 * Factory to create a realistic row object that mirrors what Kysely returns
 * from the sessions query with joins. Override any field as needed per test.
 */
function createSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "session-001",
    game: "poe1",
    league: "Settlers",
    startedAt: "2025-01-15T10:00:00Z",
    endedAt: "2025-01-15T11:30:00Z",
    durationMinutes: 90,
    totalDecksOpened: 150,
    totalExchangeValue: 45000,
    totalStashValue: 43500,
    totalExchangeNetProfit: 44550,
    totalStashNetProfit: 43050,
    exchangeChaosToDivine: 200,
    stashChaosToDivine: 195,
    stackedDeckChaosCost: 3,
    isActive: 0,
    ...overrides,
  };
}

describe("Sessions.mapper", () => {
  // ─── Basic Field Mapping ─────────────────────────────────────────────

  describe("toSessionSummaryDTO", () => {
    it("should map all fields correctly from a row", () => {
      const row = createSessionRow();
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.sessionId).toBe("session-001");
      expect(dto.game).toBe("poe1");
      expect(dto.league).toBe("Settlers");
      expect(dto.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(dto.endedAt).toBe("2025-01-15T11:30:00Z");
      expect(dto.durationMinutes).toBe(90);
      expect(dto.totalDecksOpened).toBe(150);
      expect(dto.totalExchangeValue).toBe(45000);
      expect(dto.totalStashValue).toBe(43500);
      expect(dto.totalExchangeNetProfit).toBe(44550);
      expect(dto.totalStashNetProfit).toBe(43050);
      expect(dto.exchangeChaosToDivine).toBe(200);
      expect(dto.stashChaosToDivine).toBe(195);
      expect(dto.stackedDeckChaosCost).toBe(3);
    });

    it("should produce a DTO with the correct set of keys", () => {
      const row = createSessionRow();
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      const expectedKeys = [
        "sessionId",
        "game",
        "league",
        "startedAt",
        "endedAt",
        "durationMinutes",
        "totalDecksOpened",
        "totalExchangeValue",
        "totalStashValue",
        "totalExchangeNetProfit",
        "totalStashNetProfit",
        "exchangeChaosToDivine",
        "stashChaosToDivine",
        "stackedDeckChaosCost",
        "isActive",
      ];

      expect(Object.keys(dto).sort()).toEqual(expectedKeys.sort());
    });
  });

  // ─── Boolean Conversion ──────────────────────────────────────────────

  describe("isActive boolean conversion", () => {
    it("should convert isActive = 0 to false", () => {
      const row = createSessionRow({ isActive: 0 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.isActive).toBe(false);
    });

    it("should convert isActive = 1 to true", () => {
      const row = createSessionRow({ isActive: 1 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.isActive).toBe(true);
    });

    it("should return a boolean type for isActive, not a number", () => {
      const row = createSessionRow({ isActive: 1 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(typeof dto.isActive).toBe("boolean");
    });

    it("should handle truthy isActive values as true", () => {
      const row = createSessionRow({ isActive: 1 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.isActive).toBe(true);
    });

    it("should handle falsy isActive value (0) as false", () => {
      const row = createSessionRow({ isActive: 0 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.isActive).toBe(false);
    });
  });

  // ─── Active Session ──────────────────────────────────────────────────

  describe("active session", () => {
    it("should map an active session correctly", () => {
      const row = createSessionRow({
        sessionId: "active-session",
        isActive: 1,
        endedAt: null,
        durationMinutes: null,
        totalDecksOpened: 42,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.sessionId).toBe("active-session");
      expect(dto.isActive).toBe(true);
      expect(dto.endedAt).toBeNull();
      expect(dto.durationMinutes).toBeNull();
      expect(dto.totalDecksOpened).toBe(42);
    });
  });

  // ─── Nullable Fields ─────────────────────────────────────────────────

  describe("nullable fields", () => {
    it("should handle null endedAt for active sessions", () => {
      const row = createSessionRow({ endedAt: null, isActive: 1 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.endedAt).toBeNull();
    });

    it("should handle null durationMinutes for active sessions", () => {
      const row = createSessionRow({ durationMinutes: null, isActive: 1 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.durationMinutes).toBeNull();
    });

    it("should handle null totalExchangeNetProfit", () => {
      const row = createSessionRow({ totalExchangeNetProfit: null });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.totalExchangeNetProfit).toBeNull();
    });

    it("should handle null totalStashNetProfit", () => {
      const row = createSessionRow({ totalStashNetProfit: null });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.totalStashNetProfit).toBeNull();
    });

    it("should handle both net profits being null", () => {
      const row = createSessionRow({
        totalExchangeNetProfit: null,
        totalStashNetProfit: null,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.totalExchangeNetProfit).toBeNull();
      expect(dto.totalStashNetProfit).toBeNull();
    });
  });

  // ─── Numeric Values ──────────────────────────────────────────────────

  describe("numeric values", () => {
    it("should handle zero values", () => {
      const row = createSessionRow({
        durationMinutes: 0,
        totalDecksOpened: 0,
        totalExchangeValue: 0,
        totalStashValue: 0,
        totalExchangeNetProfit: 0,
        totalStashNetProfit: 0,
        exchangeChaosToDivine: 0,
        stashChaosToDivine: 0,
        stackedDeckChaosCost: 0,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.durationMinutes).toBe(0);
      expect(dto.totalDecksOpened).toBe(0);
      expect(dto.totalExchangeValue).toBe(0);
      expect(dto.totalStashValue).toBe(0);
      expect(dto.totalExchangeNetProfit).toBe(0);
      expect(dto.totalStashNetProfit).toBe(0);
      expect(dto.exchangeChaosToDivine).toBe(0);
      expect(dto.stashChaosToDivine).toBe(0);
      expect(dto.stackedDeckChaosCost).toBe(0);
    });

    it("should handle fractional chaos-to-divine ratios", () => {
      const row = createSessionRow({
        exchangeChaosToDivine: 199.75,
        stashChaosToDivine: 194.25,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.exchangeChaosToDivine).toBe(199.75);
      expect(dto.stashChaosToDivine).toBe(194.25);
    });

    it("should handle large values", () => {
      const row = createSessionRow({
        totalDecksOpened: 10000,
        totalExchangeValue: 5000000,
        totalStashValue: 4800000,
        totalExchangeNetProfit: 4970000,
        totalStashNetProfit: 4770000,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.totalDecksOpened).toBe(10000);
      expect(dto.totalExchangeValue).toBe(5000000);
      expect(dto.totalStashValue).toBe(4800000);
      expect(dto.totalExchangeNetProfit).toBe(4970000);
      expect(dto.totalStashNetProfit).toBe(4770000);
    });

    it("should handle negative net profit", () => {
      const row = createSessionRow({
        totalExchangeNetProfit: -500,
        totalStashNetProfit: -1200,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.totalExchangeNetProfit).toBe(-500);
      expect(dto.totalStashNetProfit).toBe(-1200);
    });

    it("should handle fractional stacked deck cost", () => {
      const row = createSessionRow({ stackedDeckChaosCost: 3.75 });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.stackedDeckChaosCost).toBe(3.75);
    });
  });

  // ─── Game Types ──────────────────────────────────────────────────────

  describe("game types", () => {
    it("should handle poe1 game", () => {
      const row = createSessionRow({ game: "poe1" });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.game).toBe("poe1");
    });

    it("should handle poe2 game", () => {
      const row = createSessionRow({ game: "poe2" });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.game).toBe("poe2");
    });
  });

  // ─── Realistic Scenarios ─────────────────────────────────────────────

  describe("realistic scenarios", () => {
    it("should map a completed profitable session", () => {
      const row = createSessionRow({
        sessionId: "profitable-session",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T20:00:00Z",
        endedAt: "2025-01-15T22:30:00Z",
        durationMinutes: 150,
        totalDecksOpened: 500,
        totalExchangeValue: 120000,
        totalStashValue: 115000,
        totalExchangeNetProfit: 118500,
        totalStashNetProfit: 113500,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
        isActive: 0,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto).toEqual({
        sessionId: "profitable-session",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T20:00:00Z",
        endedAt: "2025-01-15T22:30:00Z",
        durationMinutes: 150,
        totalDecksOpened: 500,
        totalExchangeValue: 120000,
        totalStashValue: 115000,
        totalExchangeNetProfit: 118500,
        totalStashNetProfit: 113500,
        exchangeChaosToDivine: 200,
        stashChaosToDivine: 195,
        stackedDeckChaosCost: 3,
        isActive: false,
      });
    });

    it("should map an unprofitable session", () => {
      const row = createSessionRow({
        sessionId: "unprofitable-session",
        totalDecksOpened: 50,
        totalExchangeValue: 100,
        totalStashValue: 95,
        totalExchangeNetProfit: -50,
        totalStashNetProfit: -55,
        stackedDeckChaosCost: 3,
        isActive: 0,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.totalExchangeNetProfit).toBe(-50);
      expect(dto.totalStashNetProfit).toBe(-55);
      expect(dto.isActive).toBe(false);
    });

    it("should map a currently active session with partial data", () => {
      const row = createSessionRow({
        sessionId: "in-progress",
        game: "poe2",
        league: "Dawn",
        startedAt: "2025-06-01T14:00:00Z",
        endedAt: null,
        durationMinutes: null,
        totalDecksOpened: 25,
        totalExchangeValue: 5000,
        totalStashValue: 4800,
        totalExchangeNetProfit: null,
        totalStashNetProfit: null,
        exchangeChaosToDivine: 180,
        stashChaosToDivine: 175,
        stackedDeckChaosCost: 4,
        isActive: 1,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.sessionId).toBe("in-progress");
      expect(dto.game).toBe("poe2");
      expect(dto.league).toBe("Dawn");
      expect(dto.isActive).toBe(true);
      expect(dto.endedAt).toBeNull();
      expect(dto.durationMinutes).toBeNull();
      expect(dto.totalExchangeNetProfit).toBeNull();
      expect(dto.totalStashNetProfit).toBeNull();
      expect(dto.totalDecksOpened).toBe(25);
      expect(dto.totalExchangeValue).toBe(5000);
    });

    it("should map a short session with few decks", () => {
      const row = createSessionRow({
        sessionId: "short-session",
        durationMinutes: 5,
        totalDecksOpened: 3,
        totalExchangeValue: 15,
        totalStashValue: 12,
        totalExchangeNetProfit: 6,
        totalStashNetProfit: 3,
        isActive: 0,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.durationMinutes).toBe(5);
      expect(dto.totalDecksOpened).toBe(3);
      expect(dto.totalExchangeValue).toBe(15);
      expect(dto.isActive).toBe(false);
    });
  });

  // ─── Mapping Multiple Rows ───────────────────────────────────────────

  describe("mapping multiple rows", () => {
    it("should correctly map an array of rows using Array.map", () => {
      const rows = [
        createSessionRow({ sessionId: "s1", isActive: 0 }),
        createSessionRow({ sessionId: "s2", isActive: 1 }),
        createSessionRow({ sessionId: "s3", isActive: 0 }),
      ];

      const dtos = rows.map(SessionsMapper.toSessionSummaryDTO);

      expect(dtos).toHaveLength(3);
      expect(dtos[0].sessionId).toBe("s1");
      expect(dtos[0].isActive).toBe(false);
      expect(dtos[1].sessionId).toBe("s2");
      expect(dtos[1].isActive).toBe(true);
      expect(dtos[2].sessionId).toBe("s3");
      expect(dtos[2].isActive).toBe(false);
    });

    it("should produce independent DTOs for each row", () => {
      const rows = [
        createSessionRow({ sessionId: "a", totalDecksOpened: 100 }),
        createSessionRow({ sessionId: "b", totalDecksOpened: 200 }),
      ];

      const dtos = rows.map(SessionsMapper.toSessionSummaryDTO);

      expect(dtos[0].totalDecksOpened).toBe(100);
      expect(dtos[1].totalDecksOpened).toBe(200);
    });

    it("should handle empty array", () => {
      const rows: ReturnType<typeof createSessionRow>[] = [];
      const dtos = rows.map(SessionsMapper.toSessionSummaryDTO);

      expect(dtos).toEqual([]);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle league names with spaces", () => {
      const row = createSessionRow({ league: "Settlers of Kalguur" });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.league).toBe("Settlers of Kalguur");
    });

    it("should handle Standard league", () => {
      const row = createSessionRow({ league: "Standard" });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.league).toBe("Standard");
    });

    it("should handle very long duration", () => {
      const row = createSessionRow({ durationMinutes: 1440 }); // 24 hours
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.durationMinutes).toBe(1440);
    });

    it("should handle session with endedAt same as startedAt (instant stop)", () => {
      const row = createSessionRow({
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T10:00:00Z",
        durationMinutes: 0,
      });
      const dto = SessionsMapper.toSessionSummaryDTO(row);

      expect(dto.startedAt).toBe("2025-01-15T10:00:00Z");
      expect(dto.endedAt).toBe("2025-01-15T10:00:00Z");
      expect(dto.durationMinutes).toBe(0);
    });
  });
});
