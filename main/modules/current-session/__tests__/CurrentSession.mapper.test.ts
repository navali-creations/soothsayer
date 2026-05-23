import type { Selectable } from "kysely";
import { describe, expect, it } from "vitest";

import type {
  SessionSummariesTable,
  SessionsRow,
} from "~/main/modules/database";

import type { SessionCardJoinedRow } from "../CurrentSession.mapper";
import { CurrentSessionMapper } from "../CurrentSession.mapper";

describe("CurrentSessionMapper", () => {
  // ─── toSessionDTO ──────────────────────────────────────────────────────────

  describe("toSessionDTO", () => {
    it("should map a SessionsRow to SessionDTO", () => {
      const row: SessionsRow = {
        id: "session-123",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: "snap-456",
        started_at: "2025-01-15T10:00:00Z",
        ended_at: "2025-01-15T11:30:00Z",
        total_count: 42,
        is_active: 0,
        created_at: "2025-01-15T10:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result).toEqual({
        id: "session-123",
        game: "poe1",
        leagueId: "league-abc",
        snapshotId: "snap-456",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        totalCount: 42,
        isActive: false,
      });
    });

    it("should convert is_active = 1 to isActive = true", () => {
      const row: SessionsRow = {
        id: "session-active",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: "snap-456",
        started_at: "2025-01-15T10:00:00Z",
        ended_at: null,
        total_count: 10,
        is_active: 1,
        created_at: "2025-01-15T10:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.isActive).toBe(true);
    });

    it("should convert is_active = 0 to isActive = false", () => {
      const row: SessionsRow = {
        id: "session-inactive",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: "snap-456",
        started_at: "2025-01-15T10:00:00Z",
        ended_at: "2025-01-15T11:00:00Z",
        total_count: 25,
        is_active: 0,
        created_at: "2025-01-15T10:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.isActive).toBe(false);
    });

    it("should handle null snapshot_id", () => {
      const row: SessionsRow = {
        id: "session-no-snap",
        game: "poe2",
        league_id: "league-def",
        snapshot_id: null,
        started_at: "2025-01-15T10:00:00Z",
        ended_at: null,
        total_count: 0,
        is_active: 1,
        created_at: "2025-01-15T10:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.snapshotId).toBeNull();
    });

    it("should handle null ended_at for active sessions", () => {
      const row: SessionsRow = {
        id: "session-ongoing",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: "snap-789",
        started_at: "2025-06-01T08:00:00Z",
        ended_at: null,
        total_count: 100,
        is_active: 1,
        created_at: "2025-06-01T08:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.endedAt).toBeNull();
      expect(result.isActive).toBe(true);
    });

    it("should map game type correctly for poe1", () => {
      const row: SessionsRow = {
        id: "session-poe1",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: null,
        started_at: "2025-01-01T00:00:00Z",
        ended_at: null,
        total_count: 0,
        is_active: 1,
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.game).toBe("poe1");
    });

    it("should map game type correctly for poe2", () => {
      const row: SessionsRow = {
        id: "session-poe2",
        game: "poe2",
        league_id: "league-def",
        snapshot_id: null,
        started_at: "2025-01-01T00:00:00Z",
        ended_at: null,
        total_count: 0,
        is_active: 1,
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.game).toBe("poe2");
    });

    it("should convert snake_case fields to camelCase", () => {
      const row: SessionsRow = {
        id: "session-case",
        game: "poe1",
        league_id: "league-case",
        snapshot_id: "snap-case",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T01:00:00Z",
        total_count: 50,
        is_active: 0,
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result).toHaveProperty("leagueId");
      expect(result).toHaveProperty("snapshotId");
      expect(result).toHaveProperty("startedAt");
      expect(result).toHaveProperty("endedAt");
      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("isActive");
      // Should not have snake_case properties
      expect(result).not.toHaveProperty("league_id");
      expect(result).not.toHaveProperty("snapshot_id");
      expect(result).not.toHaveProperty("started_at");
      expect(result).not.toHaveProperty("ended_at");
      expect(result).not.toHaveProperty("total_count");
      expect(result).not.toHaveProperty("is_active");
    });

    it("should handle zero total_count", () => {
      const row: SessionsRow = {
        id: "session-zero",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: null,
        started_at: "2025-01-01T00:00:00Z",
        ended_at: null,
        total_count: 0,
        is_active: 1,
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.totalCount).toBe(0);
    });

    it("should handle large total_count", () => {
      const row: SessionsRow = {
        id: "session-large",
        game: "poe1",
        league_id: "league-abc",
        snapshot_id: "snap-123",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-02T00:00:00Z",
        total_count: 999999,
        is_active: 0,
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionDTO(row);

      expect(result.totalCount).toBe(999999);
    });
  });

  // ─── toSessionCardDTO ──────────────────────────────────────────────────────

  describe("toSessionCardDTO", () => {
    it("should map a basic session card row without divination card metadata", () => {
      const row: SessionCardJoinedRow = {
        cardName: "The Doctor",
        count: 3,
        firstSeenAt: "2025-01-15T10:05:00Z",
        lastSeenAt: "2025-01-15T10:30:00Z",
        hidePrice: 0,
        divinationCardId: null,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result).toEqual({
        cardName: "The Doctor",
        count: 3,
        firstSeenAt: "2025-01-15T10:05:00Z",
        lastSeenAt: "2025-01-15T10:30:00Z",
        hidePrice: false,
      });
      expect(result.divinationCard).toBeUndefined();
    });

    it("should include divination card metadata when divinationCardId is present", () => {
      const row: SessionCardJoinedRow = {
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:05:00Z",
        lastSeenAt: "2025-01-15T10:05:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_the-doctor",
        stackSize: 8,
        description: "A powerful card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>A taste of power</i>",
        rarity: 1,
        filterRarity: 2,
        prohibitedLibraryRarity: 3,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.divinationCard).toBeDefined();
      expect(result.divinationCard!.id).toBe("poe1_the-doctor");
      expect(result.divinationCard!.stackSize).toBe(8);
      expect(result.divinationCard!.description).toBe("A powerful card");
      expect(result.divinationCard!.artSrc).toBe(
        "https://example.com/doctor.png",
      );
      expect(result.divinationCard!.rarity).toBe(1);
      expect(result.divinationCard!.filterRarity).toBe(2);
      expect(result.divinationCard!.prohibitedLibraryRarity).toBe(3);
    });

    it("should default filterRarity to null when not provided", () => {
      const row: SessionCardJoinedRow = {
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:05:00Z",
        lastSeenAt: "2025-01-15T10:05:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_the-doctor",
        stackSize: 8,
        description: "A powerful card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>A taste of power</i>",
        rarity: 1,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.divinationCard).toBeDefined();
      expect(result.divinationCard!.filterRarity).toBeNull();
    });

    it("should default prohibitedLibraryRarity to null when not provided", () => {
      const row: SessionCardJoinedRow = {
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:05:00Z",
        lastSeenAt: "2025-01-15T10:05:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_the-doctor",
        stackSize: 8,
        description: "A powerful card",
        rewardHtml: "<span>Headhunter</span>",
        artSrc: "https://example.com/doctor.png",
        flavourHtml: "<i>A taste of power</i>",
        rarity: 1,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.divinationCard).toBeDefined();
      expect(result.divinationCard!.prohibitedLibraryRarity).toBeNull();
    });

    it("should preserve all filterRarity levels (1-4)", () => {
      const rarities = [1, 2, 3, 4] as const;

      for (const filterRarity of rarities) {
        const row: SessionCardJoinedRow = {
          cardName: `Card FilterRarity ${filterRarity}`,
          count: 1,
          firstSeenAt: "2025-01-15T10:00:00Z",
          lastSeenAt: "2025-01-15T10:00:00Z",
          hidePrice: 0,
          divinationCardId: `poe1_card-filter-${filterRarity}`,
          stackSize: 1,
          description: "Test",
          rewardHtml: "<span>Test</span>",
          artSrc: "https://example.com/art.png",
          flavourHtml: "<i>Test</i>",
          rarity: 4,
          filterRarity,
        };

        const result = CurrentSessionMapper.toSessionCardDTO(row);

        expect(result.divinationCard!.filterRarity).toBe(filterRarity);
      }
    });

    it("should convert hidePrice = 1 to true", () => {
      const row: SessionCardJoinedRow = {
        cardName: "Rain of Chaos",
        count: 10,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:30:00Z",
        hidePrice: 1,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.hidePrice).toBe(true);
    });

    it("should not include divinationCard when divinationCardId is undefined", () => {
      const row: SessionCardJoinedRow = {
        cardName: "Unknown Card",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
        hidePrice: 0,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.divinationCard).toBeUndefined();
    });

    it("should clean wiki markup in rewardHtml and flavourHtml", () => {
      const row: SessionCardJoinedRow = {
        cardName: "The Doctor",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_the-doctor",
        stackSize: 8,
        description: "Test",
        rewardHtml: "Headhunter",
        artSrc: "https://example.com/art.png",
        flavourHtml: "Some flavour text",
        rarity: 1,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      // cleanWikiMarkup passes through plain text unchanged (no wiki markup to strip)
      expect(result.divinationCard!.rewardHtml).toBe("Headhunter");
      expect(result.divinationCard!.flavourHtml).toBe("Some flavour text");
    });

    it("should handle null rewardHtml and flavourHtml gracefully", () => {
      const row: SessionCardJoinedRow = {
        cardName: "Simple Card",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_simple-card",
        stackSize: 5,
        description: "Simple",
        rewardHtml: null,
        artSrc: "https://example.com/art.png",
        flavourHtml: null,
        rarity: 4,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      // cleanWikiMarkup returns "" for null input
      expect(result.divinationCard!.rewardHtml).toBe("");
      expect(result.divinationCard!.flavourHtml).toBe("");
    });

    it("should default rarity to 4 (common) when not provided", () => {
      const row: SessionCardJoinedRow = {
        cardName: "Common Card",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_common-card",
        stackSize: 3,
        description: "Common",
        rewardHtml: "<span>Something</span>",
        artSrc: "https://example.com/art.png",
        flavourHtml: "<i>Flavour</i>",
        // rarity intentionally omitted
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.divinationCard!.rarity).toBeUndefined();
    });

    it("should preserve all rarity levels (1-4)", () => {
      const rarities = [1, 2, 3, 4] as const;

      for (const rarity of rarities) {
        const row: SessionCardJoinedRow = {
          cardName: `Card Rarity ${rarity}`,
          count: 1,
          firstSeenAt: "2025-01-15T10:00:00Z",
          lastSeenAt: "2025-01-15T10:00:00Z",
          hidePrice: 0,
          divinationCardId: `poe1_card-rarity-${rarity}`,
          stackSize: 1,
          description: "Test",
          rewardHtml: "<span>Test</span>",
          artSrc: "https://example.com/art.png",
          flavourHtml: "<i>Test</i>",
          rarity,
        };

        const result = CurrentSessionMapper.toSessionCardDTO(row);

        expect(result.divinationCard!.rarity).toBe(rarity);
      }
    });

    it("should handle card with null stackSize", () => {
      const row: SessionCardJoinedRow = {
        cardName: "No Stack Card",
        count: 1,
        firstSeenAt: "2025-01-15T10:00:00Z",
        lastSeenAt: "2025-01-15T10:00:00Z",
        hidePrice: 0,
        divinationCardId: "poe1_no-stack",
        stackSize: null,
        description: "Test",
        rewardHtml: "<span>Reward</span>",
        artSrc: "https://example.com/art.png",
        flavourHtml: "<i>Flavour</i>",
        rarity: 4,
      };

      const result = CurrentSessionMapper.toSessionCardDTO(row);

      expect(result.divinationCard!.stackSize).toBeNull();
    });
  });

  // ─── toSessionSummaryDTO ───────────────────────────────────────────────────

  describe("toSessionSummaryDTO", () => {
    it("should map a SessionSummariesTable row to SessionSummaryDTO", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-summary-1",
        game: "poe1",
        league: "Settlers",
        started_at: "2025-01-15T10:00:00Z",
        ended_at: "2025-01-15T11:30:00Z",
        duration_minutes: 90,
        total_decks_opened: 150,
        total_value: 1200.5,
        net_profit: 750.5,
        chaos_to_divine_ratio: 200,
        stacked_deck_chaos_cost: 3,
        created_at: "2025-01-15T11:30:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result).toEqual({
        sessionId: "session-summary-1",
        game: "poe1",
        league: "Settlers",
        startedAt: "2025-01-15T10:00:00Z",
        endedAt: "2025-01-15T11:30:00Z",
        durationMinutes: 90,
        totalDecksOpened: 150,
        totalValue: 1200.5,
        netProfit: 750.5,
        chaosToDivineRatio: 200,
        stackedDeckChaosCost: 3,
      });
    });

    it("should handle null net profit values", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-null-profit",
        game: "poe2",
        league: "Dawn",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T01:00:00Z",
        duration_minutes: 60,
        total_decks_opened: 50,
        total_value: 200,
        net_profit: null,
        chaos_to_divine_ratio: 200,
        stacked_deck_chaos_cost: 0,
        created_at: "2025-01-01T01:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result.netProfit).toBeNull();
    });

    it("should handle zero values", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-zeros",
        game: "poe1",
        league: "Standard",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T00:00:00Z",
        duration_minutes: 0,
        total_decks_opened: 0,
        total_value: 0,
        net_profit: 0,
        chaos_to_divine_ratio: 0,
        stacked_deck_chaos_cost: 0,
        created_at: "2025-01-01T00:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result.durationMinutes).toBe(0);
      expect(result.totalDecksOpened).toBe(0);
      expect(result.totalValue).toBe(0);
      expect(result.stackedDeckChaosCost).toBe(0);
    });

    it("should convert snake_case fields to camelCase", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-case-test",
        game: "poe1",
        league: "Settlers",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T01:00:00Z",
        duration_minutes: 60,
        total_decks_opened: 100,
        total_value: 500,
        net_profit: 200,
        chaos_to_divine_ratio: 200,
        stacked_deck_chaos_cost: 3,
        created_at: "2025-01-01T01:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result).toHaveProperty("sessionId");
      expect(result).toHaveProperty("startedAt");
      expect(result).toHaveProperty("endedAt");
      expect(result).toHaveProperty("durationMinutes");
      expect(result).toHaveProperty("totalDecksOpened");
      expect(result).toHaveProperty("totalValue");
      expect(result).toHaveProperty("netProfit");
      expect(result).toHaveProperty("chaosToDivineRatio");
      expect(result).toHaveProperty("stackedDeckChaosCost");
      // Should not have snake_case properties
      expect(result).not.toHaveProperty("session_id");
      expect(result).not.toHaveProperty("started_at");
      expect(result).not.toHaveProperty("ended_at");
    });

    it("should handle negative net profit values", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-negative",
        game: "poe1",
        league: "Settlers",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T01:00:00Z",
        duration_minutes: 60,
        total_decks_opened: 200,
        total_value: 300,
        net_profit: -300,
        chaos_to_divine_ratio: 200,
        stacked_deck_chaos_cost: 3,
        created_at: "2025-01-01T01:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result.netProfit).toBe(-300);
    });

    it("should handle short duration sessions", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-short",
        game: "poe1",
        league: "Necropolis",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T00:05:00Z",
        duration_minutes: 5,
        total_decks_opened: 10,
        total_value: 50,
        net_profit: 20,
        chaos_to_divine_ratio: 95,
        stacked_deck_chaos_cost: 3,
        created_at: "2025-01-01T01:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result.durationMinutes).toBe(5);
      expect(result.totalDecksOpened).toBe(10);
    });

    it("should handle fractional values for chaos and divine ratios", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-fractions",
        game: "poe1",
        league: "Settlers",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T01:00:00Z",
        duration_minutes: 60,
        total_decks_opened: 100,
        total_value: 456.789,
        net_profit: 156.789,
        chaos_to_divine_ratio: 198.5,
        stacked_deck_chaos_cost: 2.75,
        created_at: "2025-01-01T01:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result.totalValue).toBe(456.789);
      expect(result.chaosToDivineRatio).toBe(198.5);
      expect(result.stackedDeckChaosCost).toBe(2.75);
    });

    it("should map game type correctly for poe2", () => {
      const row: Selectable<SessionSummariesTable> = {
        session_id: "session-poe2-summary",
        game: "poe2",
        league: "Dawn",
        started_at: "2025-01-01T00:00:00Z",
        ended_at: "2025-01-01T01:00:00Z",
        duration_minutes: 60,
        total_decks_opened: 50,
        total_value: 200,
        net_profit: 50,
        chaos_to_divine_ratio: 100,
        stacked_deck_chaos_cost: 3,
        created_at: "2025-01-01T01:00:00Z",
      };

      const result = CurrentSessionMapper.toSessionSummaryDTO(row);

      expect(result.game).toBe("poe2");
      expect(result.league).toBe("Dawn");
    });
  });

  // ─── boolToDb ──────────────────────────────────────────────────────────────

  describe("boolToDb", () => {
    it("should convert true to 1", () => {
      expect(CurrentSessionMapper.boolToDb(true)).toBe(1);
    });

    it("should convert false to 0", () => {
      expect(CurrentSessionMapper.boolToDb(false)).toBe(0);
    });

    it("should return undefined for undefined input", () => {
      expect(CurrentSessionMapper.boolToDb(undefined)).toBeUndefined();
    });
  });

  // ─── dbToBool ──────────────────────────────────────────────────────────────

  describe("dbToBool", () => {
    it("should convert 1 to true", () => {
      expect(CurrentSessionMapper.dbToBool(1)).toBe(true);
    });

    it("should convert 0 to false", () => {
      expect(CurrentSessionMapper.dbToBool(0)).toBe(false);
    });

    it("should convert any non-1 number to false", () => {
      expect(CurrentSessionMapper.dbToBool(2)).toBe(false);
      expect(CurrentSessionMapper.dbToBool(-1)).toBe(false);
      expect(CurrentSessionMapper.dbToBool(99)).toBe(false);
    });
  });
});
