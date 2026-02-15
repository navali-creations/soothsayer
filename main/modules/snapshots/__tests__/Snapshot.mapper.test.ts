import { describe, expect, it } from "vitest";

import type {
  LeaguesRow,
  SnapshotCardPricesRow,
  SnapshotsRow,
} from "~/main/modules/database";

import { SnapshotMapper } from "../Snapshot.mapper";

// ─── Factories ─────────────────────────────────────────────────────────────────

function createSnapshotRow(
  overrides: Partial<SnapshotsRow> = {},
): SnapshotsRow {
  return {
    id: "snap-001",
    league_id: "league-001",
    fetched_at: "2025-01-15T10:00:00Z",
    exchange_chaos_to_divine: 200,
    stash_chaos_to_divine: 195,
    stacked_deck_chaos_cost: 3.5,
    created_at: "2025-01-15T10:00:00Z",
    ...overrides,
  };
}

function createSnapshotCardPriceRow(
  overrides: Partial<SnapshotCardPricesRow> = {},
): SnapshotCardPricesRow {
  return {
    id: 1,
    snapshot_id: "snap-001",
    card_name: "The Doctor",
    price_source: "exchange" as const,
    chaos_value: 1200.5,
    divine_value: 6.0,
    confidence: 1 as const,
    ...overrides,
  };
}

function createLeagueRow(overrides: Partial<LeaguesRow> = {}): LeaguesRow {
  return {
    id: "league-001",
    name: "Settlers",
    game: "poe1",
    start_date: "2025-01-01T00:00:00Z",
    end_date: null,
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Snapshot.mapper", () => {
  // ─── toSnapshotDTO ─────────────────────────────────────────────────

  describe("toSnapshotDTO", () => {
    it("should map all fields from a snapshot row", () => {
      const row = createSnapshotRow();
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect(dto.id).toBe("snap-001");
      expect(dto.leagueId).toBe("league-001");
      expect(dto.fetchedAt).toBe("2025-01-15T10:00:00Z");
      expect(dto.exchangeChaosToDivine).toBe(200);
      expect(dto.stashChaosToDivine).toBe(195);
      expect(dto.stackedDeckChaosCost).toBe(3.5);
    });

    it("should map snake_case fields to camelCase", () => {
      const row = createSnapshotRow({
        league_id: "league-abc",
        fetched_at: "2025-06-01T12:00:00Z",
        exchange_chaos_to_divine: 180,
        stash_chaos_to_divine: 175,
        stacked_deck_chaos_cost: 4.0,
      });
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect(dto.leagueId).toBe("league-abc");
      expect(dto.fetchedAt).toBe("2025-06-01T12:00:00Z");
      expect(dto.exchangeChaosToDivine).toBe(180);
      expect(dto.stashChaosToDivine).toBe(175);
      expect(dto.stackedDeckChaosCost).toBe(4.0);
    });

    it("should not include created_at in the DTO", () => {
      const row = createSnapshotRow();
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect("createdAt" in dto).toBe(false);
      expect("created_at" in dto).toBe(false);
    });

    it("should produce a DTO with exactly the expected keys", () => {
      const row = createSnapshotRow();
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect(Object.keys(dto).sort()).toEqual([
        "exchangeChaosToDivine",
        "fetchedAt",
        "id",
        "leagueId",
        "stackedDeckChaosCost",
        "stashChaosToDivine",
      ]);
    });

    it("should handle zero values for cost fields", () => {
      const row = createSnapshotRow({
        exchange_chaos_to_divine: 0,
        stash_chaos_to_divine: 0,
        stacked_deck_chaos_cost: 0,
      });
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect(dto.exchangeChaosToDivine).toBe(0);
      expect(dto.stashChaosToDivine).toBe(0);
      expect(dto.stackedDeckChaosCost).toBe(0);
    });

    it("should handle fractional chaos-to-divine ratios", () => {
      const row = createSnapshotRow({
        exchange_chaos_to_divine: 199.75,
        stash_chaos_to_divine: 194.25,
      });
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect(dto.exchangeChaosToDivine).toBe(199.75);
      expect(dto.stashChaosToDivine).toBe(194.25);
    });

    it("should handle large ratio values", () => {
      const row = createSnapshotRow({
        exchange_chaos_to_divine: 500,
        stash_chaos_to_divine: 490,
        stacked_deck_chaos_cost: 10,
      });
      const dto = SnapshotMapper.toSnapshotDTO(row);

      expect(dto.exchangeChaosToDivine).toBe(500);
      expect(dto.stashChaosToDivine).toBe(490);
      expect(dto.stackedDeckChaosCost).toBe(10);
    });
  });

  // ─── toSnapshotCardPriceDTO ────────────────────────────────────────

  describe("toSnapshotCardPriceDTO", () => {
    it("should map all fields from a card price row", () => {
      const row = createSnapshotCardPriceRow();
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.cardName).toBe("The Doctor");
      expect(dto.priceSource).toBe("exchange");
      expect(dto.chaosValue).toBe(1200.5);
      expect(dto.divineValue).toBe(6.0);
      expect(dto.confidence).toBe(1);
    });

    it("should map snake_case fields to camelCase", () => {
      const row = createSnapshotCardPriceRow({
        card_name: "Rain of Chaos",
        price_source: "stash",
        chaos_value: 0.5,
        divine_value: 0.0025,
      });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.cardName).toBe("Rain of Chaos");
      expect(dto.priceSource).toBe("stash");
      expect(dto.chaosValue).toBe(0.5);
      expect(dto.divineValue).toBe(0.0025);
    });

    it("should handle exchange price source", () => {
      const row = createSnapshotCardPriceRow({ price_source: "exchange" });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.priceSource).toBe("exchange");
    });

    it("should handle stash price source", () => {
      const row = createSnapshotCardPriceRow({ price_source: "stash" });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.priceSource).toBe("stash");
    });

    it("should map confidence 1 (high)", () => {
      const row = createSnapshotCardPriceRow({ confidence: 1 });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.confidence).toBe(1);
    });

    it("should map confidence 2 (medium)", () => {
      const row = createSnapshotCardPriceRow({ confidence: 2 });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.confidence).toBe(2);
    });

    it("should map confidence 3 (low)", () => {
      const row = createSnapshotCardPriceRow({ confidence: 3 });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.confidence).toBe(3);
    });

    it("should not include snapshot_id or id in the DTO", () => {
      const row = createSnapshotCardPriceRow();
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect("snapshotId" in dto).toBe(false);
      expect("snapshot_id" in dto).toBe(false);
      expect("id" in dto).toBe(false);
    });

    it("should produce a DTO with exactly the expected keys", () => {
      const row = createSnapshotCardPriceRow();
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(Object.keys(dto).sort()).toEqual([
        "cardName",
        "chaosValue",
        "confidence",
        "divineValue",
        "priceSource",
      ]);
    });

    it("should handle zero chaos and divine values", () => {
      const row = createSnapshotCardPriceRow({
        chaos_value: 0,
        divine_value: 0,
      });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.chaosValue).toBe(0);
      expect(dto.divineValue).toBe(0);
    });

    it("should handle very small fractional values", () => {
      const row = createSnapshotCardPriceRow({
        chaos_value: 0.01,
        divine_value: 0.00005,
      });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.chaosValue).toBe(0.01);
      expect(dto.divineValue).toBe(0.00005);
    });

    it("should handle very large values", () => {
      const row = createSnapshotCardPriceRow({
        card_name: "Mirror Card",
        chaos_value: 50000,
        divine_value: 250,
      });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.cardName).toBe("Mirror Card");
      expect(dto.chaosValue).toBe(50000);
      expect(dto.divineValue).toBe(250);
    });

    it("should handle card names with special characters", () => {
      const row = createSnapshotCardPriceRow({
        card_name: "The King's Heart",
      });
      const dto = SnapshotMapper.toSnapshotCardPriceDTO(row);

      expect(dto.cardName).toBe("The King's Heart");
    });
  });

  // ─── toLeagueDTO ──────────────────────────────────────────────────

  describe("toLeagueDTO", () => {
    it("should map all fields from a league row", () => {
      const row = createLeagueRow();
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.id).toBe("league-001");
      expect(dto.game).toBe("poe1");
      expect(dto.name).toBe("Settlers");
      expect(dto.startDate).toBe("2025-01-01T00:00:00Z");
    });

    it("should map start_date to startDate (camelCase)", () => {
      const row = createLeagueRow({
        start_date: "2025-06-15T00:00:00Z",
      });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.startDate).toBe("2025-06-15T00:00:00Z");
    });

    it("should handle null start_date", () => {
      const row = createLeagueRow({ start_date: null });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.startDate).toBeNull();
    });

    it("should handle poe1 game", () => {
      const row = createLeagueRow({ game: "poe1" });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.game).toBe("poe1");
    });

    it("should handle poe2 game", () => {
      const row = createLeagueRow({ game: "poe2" });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.game).toBe("poe2");
    });

    it("should not include end_date or created_at in the DTO", () => {
      const row = createLeagueRow();
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect("endDate" in dto).toBe(false);
      expect("end_date" in dto).toBe(false);
      expect("createdAt" in dto).toBe(false);
      expect("created_at" in dto).toBe(false);
    });

    it("should produce a DTO with exactly the expected keys", () => {
      const row = createLeagueRow();
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(Object.keys(dto).sort()).toEqual([
        "game",
        "id",
        "name",
        "startDate",
      ]);
    });

    it("should handle Standard league", () => {
      const row = createLeagueRow({
        name: "Standard",
        start_date: null,
      });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.name).toBe("Standard");
      expect(dto.startDate).toBeNull();
    });

    it("should handle league names with spaces", () => {
      const row = createLeagueRow({ name: "Settlers of Kalguur" });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.name).toBe("Settlers of Kalguur");
    });

    it("should handle different league IDs", () => {
      const row = createLeagueRow({ id: "custom-league-id-123" });
      const dto = SnapshotMapper.toLeagueDTO(row);

      expect(dto.id).toBe("custom-league-id-123");
    });
  });

  // ─── Cross-mapper consistency ────────────────────────────────────

  describe("cross-mapper consistency", () => {
    it("should map snapshot and league referencing the same league_id", () => {
      const leagueRow = createLeagueRow({ id: "league-shared" });
      const snapshotRow = createSnapshotRow({ league_id: "league-shared" });

      const leagueDTO = SnapshotMapper.toLeagueDTO(leagueRow);
      const snapshotDTO = SnapshotMapper.toSnapshotDTO(snapshotRow);

      expect(snapshotDTO.leagueId).toBe(leagueDTO.id);
    });

    it("should map card prices referencing the same snapshot_id", () => {
      const snapshotRow = createSnapshotRow({ id: "snap-ref" });
      const cardPriceRow = createSnapshotCardPriceRow({
        snapshot_id: "snap-ref",
      });

      const snapshotDTO = SnapshotMapper.toSnapshotDTO(snapshotRow);
      const cardPriceDTO = SnapshotMapper.toSnapshotCardPriceDTO(cardPriceRow);

      // The snapshot ID should match between related entities
      expect(snapshotDTO.id).toBe("snap-ref");
      // Card price DTO doesn't include snapshot_id, which is by design
      expect("snapshotId" in cardPriceDTO).toBe(false);
    });
  });
});
