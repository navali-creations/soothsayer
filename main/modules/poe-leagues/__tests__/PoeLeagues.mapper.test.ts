import { describe, expect, it } from "vitest";

import type {
  PoeLeaguesCacheMetadataRow,
  PoeLeaguesCacheRow,
} from "~/main/modules/database";

import { PoeLeaguesMapper } from "../PoeLeagues.mapper";

// ─── Factories ─────────────────────────────────────────────────────────────────

function createPoeLeagueCacheRow(
  overrides: Partial<PoeLeaguesCacheRow> = {},
): PoeLeaguesCacheRow {
  return {
    id: "league-uuid-001",
    game: "poe1",
    league_id: "Settlers",
    name: "Settlers",
    start_at: "2025-01-01T00:00:00Z",
    end_at: "2025-04-01T00:00:00Z",
    is_active: 1,
    updated_at: "2025-01-15T12:00:00Z",
    fetched_at: "2025-01-20T08:30:00Z",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

function createPoeLeaguesCacheMetadataRow(
  overrides: Partial<PoeLeaguesCacheMetadataRow> = {},
): PoeLeaguesCacheMetadataRow {
  return {
    game: "poe1",
    last_fetched_at: "2025-01-20T08:30:00Z",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("PoeLeagues.mapper", () => {
  // ─── toPoeLeagueCacheDTO ─────────────────────────────────────────────

  describe("toPoeLeagueCacheDTO", () => {
    it("should map all fields from a league cache row", () => {
      const row = createPoeLeagueCacheRow();
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.id).toBe("league-uuid-001");
      expect(dto.game).toBe("poe1");
      expect(dto.leagueId).toBe("Settlers");
      expect(dto.name).toBe("Settlers");
      expect(dto.startAt).toBe("2025-01-01T00:00:00Z");
      expect(dto.endAt).toBe("2025-04-01T00:00:00Z");
      expect(dto.isActive).toBe(true);
      expect(dto.updatedAt).toBe("2025-01-15T12:00:00Z");
      expect(dto.fetchedAt).toBe("2025-01-20T08:30:00Z");
    });

    it("should map snake_case fields to camelCase", () => {
      const row = createPoeLeagueCacheRow({
        league_id: "Dawn",
        start_at: "2025-06-01T00:00:00Z",
        end_at: "2025-09-01T00:00:00Z",
        is_active: 0,
        updated_at: "2025-06-10T00:00:00Z",
        fetched_at: "2025-06-15T00:00:00Z",
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.leagueId).toBe("Dawn");
      expect(dto.startAt).toBe("2025-06-01T00:00:00Z");
      expect(dto.endAt).toBe("2025-09-01T00:00:00Z");
      expect(dto.isActive).toBe(false);
      expect(dto.updatedAt).toBe("2025-06-10T00:00:00Z");
      expect(dto.fetchedAt).toBe("2025-06-15T00:00:00Z");
    });

    // ─── Boolean Conversion ──────────────────────────────────────────

    it("should convert is_active = 1 to true", () => {
      const row = createPoeLeagueCacheRow({ is_active: 1 });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.isActive).toBe(true);
    });

    it("should convert is_active = 0 to false", () => {
      const row = createPoeLeagueCacheRow({ is_active: 0 });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.isActive).toBe(false);
    });

    it("should return a boolean type for isActive, not a number", () => {
      const row = createPoeLeagueCacheRow({ is_active: 1 });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(typeof dto.isActive).toBe("boolean");
    });

    // ─── Nullable Fields ─────────────────────────────────────────────

    it("should handle null start_at", () => {
      const row = createPoeLeagueCacheRow({ start_at: null });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.startAt).toBeNull();
    });

    it("should handle null end_at", () => {
      const row = createPoeLeagueCacheRow({ end_at: null });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.endAt).toBeNull();
    });

    it("should handle null updated_at", () => {
      const row = createPoeLeagueCacheRow({ updated_at: null });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.updatedAt).toBeNull();
    });

    it("should handle all nullable fields being null", () => {
      const row = createPoeLeagueCacheRow({
        start_at: null,
        end_at: null,
        updated_at: null,
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.startAt).toBeNull();
      expect(dto.endAt).toBeNull();
      expect(dto.updatedAt).toBeNull();
    });

    // ─── Game Types ──────────────────────────────────────────────────

    it("should handle poe1 game type", () => {
      const row = createPoeLeagueCacheRow({ game: "poe1" });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.game).toBe("poe1");
    });

    it("should handle poe2 game type", () => {
      const row = createPoeLeagueCacheRow({ game: "poe2" });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.game).toBe("poe2");
    });

    // ─── DTO Shape ───────────────────────────────────────────────────

    it("should produce a DTO with exactly the expected keys", () => {
      const row = createPoeLeagueCacheRow();
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(Object.keys(dto).sort()).toEqual([
        "endAt",
        "fetchedAt",
        "game",
        "id",
        "isActive",
        "leagueId",
        "name",
        "startAt",
        "updatedAt",
      ]);
    });

    it("should not include created_at in the DTO", () => {
      const row = createPoeLeagueCacheRow();
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect("createdAt" in dto).toBe(false);
      expect("created_at" in dto).toBe(false);
    });

    // ─── Realistic Data ──────────────────────────────────────────────

    it("should map Standard league correctly", () => {
      const row = createPoeLeagueCacheRow({
        id: "standard-uuid",
        game: "poe1",
        league_id: "Standard",
        name: "Standard",
        start_at: null,
        end_at: null,
        is_active: 1,
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.name).toBe("Standard");
      expect(dto.leagueId).toBe("Standard");
      expect(dto.isActive).toBe(true);
      expect(dto.startAt).toBeNull();
      expect(dto.endAt).toBeNull();
    });

    it("should map an inactive ended league correctly", () => {
      const row = createPoeLeagueCacheRow({
        id: "old-league-uuid",
        game: "poe1",
        league_id: "Crucible",
        name: "Crucible",
        start_at: "2023-04-07T00:00:00Z",
        end_at: "2023-07-07T00:00:00Z",
        is_active: 0,
        updated_at: "2023-07-07T00:00:00Z",
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.name).toBe("Crucible");
      expect(dto.isActive).toBe(false);
      expect(dto.startAt).toBe("2023-04-07T00:00:00Z");
      expect(dto.endAt).toBe("2023-07-07T00:00:00Z");
    });

    it("should map a PoE2 league correctly", () => {
      const row = createPoeLeagueCacheRow({
        id: "poe2-dawn-uuid",
        game: "poe2",
        league_id: "Dawn",
        name: "Dawn",
        start_at: "2025-06-01T00:00:00Z",
        end_at: null,
        is_active: 1,
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.game).toBe("poe2");
      expect(dto.name).toBe("Dawn");
      expect(dto.isActive).toBe(true);
      expect(dto.endAt).toBeNull();
    });

    it("should map a fully populated row", () => {
      const row = createPoeLeagueCacheRow({
        id: "full-league-uuid",
        game: "poe1",
        league_id: "Settlers",
        name: "Settlers of Kalguur",
        start_at: "2025-01-01T00:00:00Z",
        end_at: "2025-04-01T00:00:00Z",
        is_active: 1,
        updated_at: "2025-02-15T10:30:00Z",
        fetched_at: "2025-02-16T08:00:00Z",
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto).toEqual({
        id: "full-league-uuid",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers of Kalguur",
        startAt: "2025-01-01T00:00:00Z",
        endAt: "2025-04-01T00:00:00Z",
        isActive: true,
        updatedAt: "2025-02-15T10:30:00Z",
        fetchedAt: "2025-02-16T08:00:00Z",
      });
    });

    // ─── Edge Cases ──────────────────────────────────────────────────

    it("should handle league names with special characters", () => {
      const row = createPoeLeagueCacheRow({
        name: "Settlers of Kalguur",
        league_id: "Settlers of Kalguur",
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.name).toBe("Settlers of Kalguur");
      expect(dto.leagueId).toBe("Settlers of Kalguur");
    });

    it("should handle league_id different from name", () => {
      const row = createPoeLeagueCacheRow({
        league_id: "league-internal-id-123",
        name: "Settlers",
      });
      const dto = PoeLeaguesMapper.toPoeLeagueCacheDTO(row);

      expect(dto.leagueId).toBe("league-internal-id-123");
      expect(dto.name).toBe("Settlers");
    });
  });

  // ─── toPoeLeaguesCacheMetadataDTO ────────────────────────────────────

  describe("toPoeLeaguesCacheMetadataDTO", () => {
    it("should map all fields from a metadata row", () => {
      const row = createPoeLeaguesCacheMetadataRow();
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(dto.game).toBe("poe1");
      expect(dto.lastFetchedAt).toBe("2025-01-20T08:30:00Z");
    });

    it("should map last_fetched_at to lastFetchedAt (camelCase)", () => {
      const row = createPoeLeaguesCacheMetadataRow({
        last_fetched_at: "2025-06-15T14:00:00Z",
      });
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(dto.lastFetchedAt).toBe("2025-06-15T14:00:00Z");
    });

    it("should handle poe1 game type", () => {
      const row = createPoeLeaguesCacheMetadataRow({ game: "poe1" });
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(dto.game).toBe("poe1");
    });

    it("should handle poe2 game type", () => {
      const row = createPoeLeaguesCacheMetadataRow({ game: "poe2" });
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(dto.game).toBe("poe2");
    });

    it("should produce a DTO with exactly the expected keys", () => {
      const row = createPoeLeaguesCacheMetadataRow();
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(Object.keys(dto).sort()).toEqual(["game", "lastFetchedAt"]);
    });

    it("should not include created_at in the DTO", () => {
      const row = createPoeLeaguesCacheMetadataRow();
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect("createdAt" in dto).toBe(false);
      expect("created_at" in dto).toBe(false);
    });

    it("should map a realistic poe1 metadata row", () => {
      const row = createPoeLeaguesCacheMetadataRow({
        game: "poe1",
        last_fetched_at: "2025-07-01T09:45:30Z",
      });
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(dto).toEqual({
        game: "poe1",
        lastFetchedAt: "2025-07-01T09:45:30Z",
      });
    });

    it("should map a realistic poe2 metadata row", () => {
      const row = createPoeLeaguesCacheMetadataRow({
        game: "poe2",
        last_fetched_at: "2025-07-02T16:20:00Z",
      });
      const dto = PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(row);

      expect(dto).toEqual({
        game: "poe2",
        lastFetchedAt: "2025-07-02T16:20:00Z",
      });
    });
  });

  // ─── Cross-mapper consistency ────────────────────────────────────────

  describe("cross-mapper consistency", () => {
    it("should map cache row and metadata row for the same game", () => {
      const cacheRow = createPoeLeagueCacheRow({ game: "poe1" });
      const metadataRow = createPoeLeaguesCacheMetadataRow({ game: "poe1" });

      const cacheDTO = PoeLeaguesMapper.toPoeLeagueCacheDTO(cacheRow);
      const metadataDTO =
        PoeLeaguesMapper.toPoeLeaguesCacheMetadataDTO(metadataRow);

      expect(cacheDTO.game).toBe(metadataDTO.game);
    });

    it("should map multiple leagues for the same game consistently", () => {
      const leagues = [
        createPoeLeagueCacheRow({
          id: "uuid-1",
          league_id: "Settlers",
          name: "Settlers",
          is_active: 1,
        }),
        createPoeLeagueCacheRow({
          id: "uuid-2",
          league_id: "Standard",
          name: "Standard",
          is_active: 1,
        }),
        createPoeLeagueCacheRow({
          id: "uuid-3",
          league_id: "Crucible",
          name: "Crucible",
          is_active: 0,
        }),
      ];

      const dtos = leagues.map(PoeLeaguesMapper.toPoeLeagueCacheDTO);

      expect(dtos).toHaveLength(3);
      expect(dtos[0].isActive).toBe(true);
      expect(dtos[1].isActive).toBe(true);
      expect(dtos[2].isActive).toBe(false);

      // All should be poe1 (default from factory)
      for (const dto of dtos) {
        expect(dto.game).toBe("poe1");
      }
    });

    it("should map a list of leagues preserving unique IDs and names", () => {
      const rows = [
        createPoeLeagueCacheRow({
          id: "a",
          league_id: "lid-a",
          name: "Alpha",
        }),
        createPoeLeagueCacheRow({
          id: "b",
          league_id: "lid-b",
          name: "Beta",
        }),
      ];

      const dtos = rows.map(PoeLeaguesMapper.toPoeLeagueCacheDTO);

      const ids = dtos.map((d) => d.id);
      const leagueIds = dtos.map((d) => d.leagueId);
      const names = dtos.map((d) => d.name);

      expect(new Set(ids).size).toBe(2);
      expect(new Set(leagueIds).size).toBe(2);
      expect(new Set(names).size).toBe(2);
    });
  });
});
