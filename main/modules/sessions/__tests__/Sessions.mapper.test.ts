import { describe, expect, it } from "vitest";

import { SessionsMapper } from "../Sessions.mapper";

function createSessionRow(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: "session-001",
    game: "poe1",
    league: "Settlers",
    startedAt: "2025-01-15T10:00:00Z",
    endedAt: "2025-01-15T12:30:00Z",
    durationMinutes: 150,
    totalDecksOpened: 150,
    totalValue: 45000,
    netProfit: 44550,
    chaosToDivineRatio: 200,
    stackedDeckChaosCost: 3,
    isActive: 0,
    ...overrides,
  };
}

describe("SessionsMapper", () => {
  describe("toSessionSummaryDTO", () => {
    it("maps exchange-only session summary fields", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(createSessionRow());

      expect(dto).toEqual({
        sessionId: "session-001",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T12:30:00Z",
        durationMinutes: 150,
        totalDecksOpened: 150,
        totalValue: 45000,
        netProfit: 44550,
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 3,
        isActive: false,
      });
    });

    it("produces the expected DTO key shape", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(createSessionRow());

      expect(Object.keys(dto).sort()).toEqual(
        [
          "sessionId",
          "game",
          "league",
          "startedAt",
          "endedAt",
          "durationMinutes",
          "totalDecksOpened",
          "totalValue",
          "netProfit",
          "chaosToDivineRatio",
          "stackedDeckChaosCost",
          "isActive",
        ].sort(),
      );
    });

    it("converts SQLite active flags to booleans", () => {
      expect(
        SessionsMapper.toSessionSummaryDTO(createSessionRow({ isActive: 0 }))
          .isActive,
      ).toBe(false);
      expect(
        SessionsMapper.toSessionSummaryDTO(createSessionRow({ isActive: 1 }))
          .isActive,
      ).toBe(true);
      expect(
        typeof SessionsMapper.toSessionSummaryDTO(
          createSessionRow({ isActive: 1 }),
        ).isActive,
      ).toBe("boolean");
    });

    it("keeps nullable end and profit fields", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(
        createSessionRow({
          endedAt: null,
          durationMinutes: null,
          netProfit: null,
          isActive: 1,
        }),
      );

      expect(dto.endedAt).toBeNull();
      expect(dto.durationMinutes).toBeNull();
      expect(dto.netProfit).toBeNull();
      expect(dto.isActive).toBe(true);
    });

    it("maps an active session with partial totals", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(
        createSessionRow({
          sessionId: "active-session",
          game: "poe2",
          league: "Dawn",
          endedAt: null,
          durationMinutes: null,
          totalDecksOpened: 25,
          totalValue: 5000,
          netProfit: null,
          chaosToDivineRatio: 180,
          stackedDeckChaosCost: 4,
          isActive: 1,
        }),
      );

      expect(dto).toEqual(
        expect.objectContaining({
          sessionId: "active-session",
          game: "poe2",
          league: "Dawn",
          endedAt: null,
          durationMinutes: null,
          totalDecksOpened: 25,
          totalValue: 5000,
          netProfit: null,
          chaosToDivineRatio: 180,
          stackedDeckChaosCost: 4,
          isActive: true,
        }),
      );
    });

    it("preserves zero and fractional values", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(
        createSessionRow({
          totalDecksOpened: 0,
          totalValue: 0,
          netProfit: 0,
          chaosToDivineRatio: 199.75,
          stackedDeckChaosCost: 2.5,
        }),
      );

      expect(dto.totalDecksOpened).toBe(0);
      expect(dto.totalValue).toBe(0);
      expect(dto.netProfit).toBe(0);
      expect(dto.chaosToDivineRatio).toBe(199.75);
      expect(dto.stackedDeckChaosCost).toBe(2.5);
    });

    it("preserves negative profit and large totals", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(
        createSessionRow({
          totalDecksOpened: 10_000,
          totalValue: 5_000_000,
          netProfit: -1_200,
          chaosToDivineRatio: 250,
        }),
      );

      expect(dto.totalDecksOpened).toBe(10_000);
      expect(dto.totalValue).toBe(5_000_000);
      expect(dto.netProfit).toBe(-1_200);
      expect(dto.chaosToDivineRatio).toBe(250);
    });

    it("passes through game and league values", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(
        createSessionRow({
          game: "poe2",
          league: "Hardcore Standard",
        }),
      );

      expect(dto.game).toBe("poe2");
      expect(dto.league).toBe("Hardcore Standard");
    });

    it("adds cardCount only for card-search rows", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(
        createSessionRow({ cardCount: 7 }),
      );

      expect(dto.cardCount).toBe(7);
    });

    it("omits cardCount for normal session rows", () => {
      const dto = SessionsMapper.toSessionSummaryDTO(createSessionRow());

      expect(dto).not.toHaveProperty("cardCount");
    });

    it("maps multiple rows independently", () => {
      const rows = [
        createSessionRow({ sessionId: "s1", totalDecksOpened: 100 }),
        createSessionRow({ sessionId: "s2", totalDecksOpened: 200 }),
        createSessionRow({ sessionId: "s3", isActive: 1 }),
      ];

      const dtos = rows.map(SessionsMapper.toSessionSummaryDTO);

      expect(dtos).toHaveLength(3);
      expect(dtos[0]).toEqual(
        expect.objectContaining({ sessionId: "s1", totalDecksOpened: 100 }),
      );
      expect(dtos[1]).toEqual(
        expect.objectContaining({ sessionId: "s2", totalDecksOpened: 200 }),
      );
      expect(dtos[2]).toEqual(
        expect.objectContaining({ sessionId: "s3", isActive: true }),
      );
    });
  });
});
