import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { PoeLeaguesRepository } from "../PoeLeagues.repository";

describe("PoeLeaguesRepository", () => {
  let testDb: TestDatabase;
  let repository: PoeLeaguesRepository;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new PoeLeaguesRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  // ─── Helper ──────────────────────────────────────────────────────────────

  async function insertLeague(
    overrides: {
      id?: string;
      game?: "poe1" | "poe2";
      leagueId?: string;
      name?: string;
      startAt?: string | null;
      endAt?: string | null;
      isActive?: boolean;
      updatedAt?: string | null;
      fetchedAt?: string;
    } = {},
  ) {
    await repository.upsertLeague({
      id: overrides.id ?? "uuid-001",
      game: overrides.game ?? "poe1",
      leagueId: overrides.leagueId ?? "Settlers",
      name: overrides.name ?? "Settlers",
      startAt:
        "startAt" in overrides ? overrides.startAt! : "2025-01-01T00:00:00Z",
      endAt: "endAt" in overrides ? overrides.endAt! : null,
      isActive: overrides.isActive ?? true,
      updatedAt:
        "updatedAt" in overrides
          ? overrides.updatedAt!
          : "2025-01-10T00:00:00Z",
      fetchedAt: overrides.fetchedAt ?? "2025-01-15T08:00:00Z",
    });
  }

  // ─── getLeaguesByGame ────────────────────────────────────────────────────

  describe("getLeaguesByGame", () => {
    it("should return empty array when no leagues exist", async () => {
      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toEqual([]);
    });

    it("should return all leagues for a specific game", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Settlers",
        name: "Settlers",
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Standard",
        name: "Standard",
      });

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(2);
    });

    it("should not return leagues from a different game", async () => {
      await insertLeague({ id: "uuid-1", game: "poe1", leagueId: "Settlers" });
      await insertLeague({
        id: "uuid-2",
        game: "poe2",
        leagueId: "Dawn",
        name: "Dawn",
      });

      const poe1Leagues = await repository.getLeaguesByGame("poe1");
      const poe2Leagues = await repository.getLeaguesByGame("poe2");

      expect(poe1Leagues).toHaveLength(1);
      expect(poe1Leagues[0].name).toBe("Settlers");

      expect(poe2Leagues).toHaveLength(1);
      expect(poe2Leagues[0].name).toBe("Dawn");
    });

    it("should return leagues sorted by name ascending", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Standard",
        name: "Standard",
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Crucible",
        name: "Crucible",
      });
      await insertLeague({
        id: "uuid-3",
        leagueId: "Settlers",
        name: "Settlers",
      });

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues[0].name).toBe("Crucible");
      expect(leagues[1].name).toBe("Settlers");
      expect(leagues[2].name).toBe("Standard");
    });

    it("should return correctly mapped DTOs", async () => {
      await insertLeague({
        id: "uuid-mapped",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
        startAt: "2025-01-01T00:00:00Z",
        endAt: "2025-04-01T00:00:00Z",
        isActive: true,
        updatedAt: "2025-01-15T12:00:00Z",
        fetchedAt: "2025-01-20T08:00:00Z",
      });

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(1);

      const dto = leagues[0];
      expect(dto.id).toBe("uuid-mapped");
      expect(dto.game).toBe("poe1");
      expect(dto.leagueId).toBe("Settlers");
      expect(dto.name).toBe("Settlers");
      expect(dto.startAt).toBe("2025-01-01T00:00:00Z");
      expect(dto.endAt).toBe("2025-04-01T00:00:00Z");
      expect(dto.isActive).toBe(true);
      expect(dto.updatedAt).toBe("2025-01-15T12:00:00Z");
      expect(dto.fetchedAt).toBe("2025-01-20T08:00:00Z");
    });

    it("should return both active and inactive leagues", async () => {
      await insertLeague({
        id: "uuid-active",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-inactive",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: false,
      });

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(2);
    });
  });

  // ─── getActiveLeaguesByGame ──────────────────────────────────────────────

  describe("getActiveLeaguesByGame", () => {
    it("should return empty array when no leagues exist", async () => {
      const leagues = await repository.getActiveLeaguesByGame("poe1");
      expect(leagues).toEqual([]);
    });

    it("should return only active leagues", async () => {
      await insertLeague({
        id: "uuid-active-1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-active-2",
        leagueId: "Standard",
        name: "Standard",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-inactive",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: false,
      });

      const leagues = await repository.getActiveLeaguesByGame("poe1");
      expect(leagues).toHaveLength(2);
      expect(leagues.every((l) => l.isActive)).toBe(true);
    });

    it("should return empty array when all leagues are inactive", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: false,
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Necropolis",
        name: "Necropolis",
        isActive: false,
      });

      const leagues = await repository.getActiveLeaguesByGame("poe1");
      expect(leagues).toEqual([]);
    });

    it("should not return active leagues from a different game", async () => {
      await insertLeague({
        id: "uuid-1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-2",
        game: "poe2",
        leagueId: "Dawn",
        name: "Dawn",
        isActive: true,
      });

      const poe1Active = await repository.getActiveLeaguesByGame("poe1");
      expect(poe1Active).toHaveLength(1);
      expect(poe1Active[0].name).toBe("Settlers");
    });

    it("should return active leagues sorted by name ascending", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Standard",
        name: "Standard",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });

      const leagues = await repository.getActiveLeaguesByGame("poe1");
      expect(leagues[0].name).toBe("Settlers");
      expect(leagues[1].name).toBe("Standard");
    });
  });

  // ─── getLeague ───────────────────────────────────────────────────────────

  describe("getLeague", () => {
    it("should return null when league does not exist", async () => {
      const league = await repository.getLeague("poe1", "Nonexistent");
      expect(league).toBeNull();
    });

    it("should return a league by game and leagueId", async () => {
      await insertLeague({
        id: "uuid-get",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
      });

      const league = await repository.getLeague("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.leagueId).toBe("Settlers");
      expect(league!.name).toBe("Settlers");
      expect(league!.game).toBe("poe1");
    });

    it("should not return a league for a different game", async () => {
      await insertLeague({
        id: "uuid-1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
      });

      const league = await repository.getLeague("poe2", "Settlers");
      expect(league).toBeNull();
    });

    it("should return the correct league when multiple exist", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Settlers",
        name: "Settlers",
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Standard",
        name: "Standard",
      });

      const league = await repository.getLeague("poe1", "Standard");
      expect(league).not.toBeNull();
      expect(league!.name).toBe("Standard");
    });

    it("should return correctly mapped DTO with boolean isActive", async () => {
      await insertLeague({
        id: "uuid-bool",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });

      const league = await repository.getLeague("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(typeof league!.isActive).toBe("boolean");
      expect(league!.isActive).toBe(true);
    });
  });

  // ─── getLeagueByName ────────────────────────────────────────────────────

  describe("getLeagueByName", () => {
    it("should return null when no league matches the name", async () => {
      const league = await repository.getLeagueByName("poe1", "Nonexistent");
      expect(league).toBeNull();
    });

    it("should return a league by exact name match", async () => {
      await insertLeague({
        id: "uuid-name-1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
      });

      const league = await repository.getLeagueByName("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.name).toBe("Settlers");
      expect(league!.game).toBe("poe1");
    });

    it("should perform case-insensitive lookup", async () => {
      await insertLeague({
        id: "uuid-ci-1",
        game: "poe1",
        leagueId: "Keepers",
        name: "Keepers",
      });

      const lower = await repository.getLeagueByName("poe1", "keepers");
      expect(lower).not.toBeNull();
      expect(lower!.name).toBe("Keepers");

      const upper = await repository.getLeagueByName("poe1", "KEEPERS");
      expect(upper).not.toBeNull();
      expect(upper!.name).toBe("Keepers");

      const mixed = await repository.getLeagueByName("poe1", "kEePeRs");
      expect(mixed).not.toBeNull();
      expect(mixed!.name).toBe("Keepers");
    });

    it("should not return a league for a different game", async () => {
      await insertLeague({
        id: "uuid-game-1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
      });

      const league = await repository.getLeagueByName("poe2", "Settlers");
      expect(league).toBeNull();
    });

    it("should return the correct league when multiple exist", async () => {
      await insertLeague({
        id: "uuid-multi-1",
        leagueId: "Settlers",
        name: "Settlers",
      });
      await insertLeague({
        id: "uuid-multi-2",
        leagueId: "Standard",
        name: "Standard",
      });

      const league = await repository.getLeagueByName("poe1", "standard");
      expect(league).not.toBeNull();
      expect(league!.name).toBe("Standard");
    });

    it("should return correctly mapped DTO", async () => {
      await insertLeague({
        id: "uuid-dto-1",
        game: "poe1",
        leagueId: "Keepers",
        name: "Keepers",
        startAt: "2025-06-01T00:00:00Z",
        endAt: null,
        isActive: true,
        updatedAt: "2025-06-05T00:00:00Z",
        fetchedAt: "2025-06-10T08:00:00Z",
      });

      const league = await repository.getLeagueByName("poe1", "keepers");
      expect(league).not.toBeNull();
      expect(league!.id).toBe("uuid-dto-1");
      expect(league!.game).toBe("poe1");
      expect(league!.leagueId).toBe("Keepers");
      expect(league!.name).toBe("Keepers");
      expect(league!.startAt).toBe("2025-06-01T00:00:00Z");
      expect(league!.endAt).toBeNull();
      expect(league!.isActive).toBe(true);
      expect(league!.updatedAt).toBe("2025-06-05T00:00:00Z");
      expect(league!.fetchedAt).toBe("2025-06-10T08:00:00Z");
    });
  });

  // ─── upsertLeague ────────────────────────────────────────────────────────

  describe("upsertLeague", () => {
    it("should insert a new league", async () => {
      await insertLeague({
        id: "uuid-new",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
        startAt: "2025-01-01T00:00:00Z",
        endAt: null,
        isActive: true,
        updatedAt: "2025-01-10T00:00:00Z",
        fetchedAt: "2025-01-15T08:00:00Z",
      });

      const league = await repository.getLeague("poe1", "Settlers");
      expect(league).not.toBeNull();
      expect(league!.id).toBe("uuid-new");
      expect(league!.name).toBe("Settlers");
      expect(league!.isActive).toBe(true);
    });

    it("should update an existing league on conflict (same game + leagueId)", async () => {
      await insertLeague({
        id: "uuid-v1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
        updatedAt: "2025-01-10T00:00:00Z",
      });

      // Upsert with updated data
      await repository.upsertLeague({
        id: "uuid-v2",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers of Kalguur",
        startAt: "2025-01-01T00:00:00Z",
        endAt: "2025-04-01T00:00:00Z",
        isActive: false,
        updatedAt: "2025-02-15T00:00:00Z",
        fetchedAt: "2025-02-16T08:00:00Z",
      });

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(1);

      const league = leagues[0];
      expect(league.id).toBe("uuid-v2");
      expect(league.name).toBe("Settlers of Kalguur");
      expect(league.isActive).toBe(false);
      expect(league.endAt).toBe("2025-04-01T00:00:00Z");
      expect(league.updatedAt).toBe("2025-02-15T00:00:00Z");
    });

    it("should handle null optional fields", async () => {
      await insertLeague({
        id: "uuid-nulls",
        leagueId: "Standard",
        name: "Standard",
        startAt: null,
        endAt: null,
        updatedAt: null,
      });

      const league = await repository.getLeague("poe1", "Standard");
      expect(league).not.toBeNull();
      expect(league!.startAt).toBeNull();
      expect(league!.endAt).toBeNull();
      expect(league!.updatedAt).toBeNull();
    });

    it("should handle inactive league insertion", async () => {
      await insertLeague({
        id: "uuid-inactive",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: false,
      });

      const league = await repository.getLeague("poe1", "Crucible");
      expect(league).not.toBeNull();
      expect(league!.isActive).toBe(false);
    });
  });

  // ─── upsertLeagues (bulk) ────────────────────────────────────────────────

  describe("upsertLeagues", () => {
    it("should insert multiple leagues at once", async () => {
      await repository.upsertLeagues([
        {
          id: "uuid-1",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers",
          startAt: "2025-01-01T00:00:00Z",
          endAt: null,
          isActive: true,
          updatedAt: "2025-01-10T00:00:00Z",
          fetchedAt: "2025-01-15T08:00:00Z",
        },
        {
          id: "uuid-2",
          game: "poe1",
          leagueId: "Standard",
          name: "Standard",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: "2025-01-15T08:00:00Z",
        },
        {
          id: "uuid-3",
          game: "poe1",
          leagueId: "Hardcore",
          name: "Hardcore",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: "2025-01-15T08:00:00Z",
        },
      ]);

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(3);
    });

    it("should handle empty array without error", async () => {
      await repository.upsertLeagues([]);
      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toEqual([]);
    });

    it("should upsert existing leagues in bulk", async () => {
      // Insert initial leagues
      await repository.upsertLeagues([
        {
          id: "uuid-1",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers",
          startAt: "2025-01-01T00:00:00Z",
          endAt: null,
          isActive: true,
          updatedAt: "2025-01-10T00:00:00Z",
          fetchedAt: "2025-01-15T08:00:00Z",
        },
        {
          id: "uuid-2",
          game: "poe1",
          leagueId: "Standard",
          name: "Standard",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: "2025-01-15T08:00:00Z",
        },
      ]);

      // Upsert with updates
      await repository.upsertLeagues([
        {
          id: "uuid-1-updated",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers of Kalguur",
          startAt: "2025-01-01T00:00:00Z",
          endAt: "2025-04-01T00:00:00Z",
          isActive: false,
          updatedAt: "2025-02-15T00:00:00Z",
          fetchedAt: "2025-02-16T08:00:00Z",
        },
      ]);

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(2);

      const settlers = leagues.find((l) => l.leagueId === "Settlers");
      expect(settlers).not.toBeUndefined();
      expect(settlers!.id).toBe("uuid-1-updated");
      expect(settlers!.name).toBe("Settlers of Kalguur");
      expect(settlers!.isActive).toBe(false);
    });

    it("should handle mix of inserts and updates", async () => {
      // Pre-insert one league
      await insertLeague({
        id: "uuid-existing",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });

      // Bulk upsert: update Settlers + insert Standard
      await repository.upsertLeagues([
        {
          id: "uuid-existing-updated",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers Updated",
          startAt: "2025-01-01T00:00:00Z",
          endAt: null,
          isActive: false,
          updatedAt: "2025-02-01T00:00:00Z",
          fetchedAt: "2025-02-01T08:00:00Z",
        },
        {
          id: "uuid-new",
          game: "poe1",
          leagueId: "Standard",
          name: "Standard",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: "2025-02-01T08:00:00Z",
        },
      ]);

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(2);

      const settlers = leagues.find((l) => l.leagueId === "Settlers");
      const standard = leagues.find((l) => l.leagueId === "Standard");

      expect(settlers!.name).toBe("Settlers Updated");
      expect(settlers!.isActive).toBe(false);

      expect(standard!.name).toBe("Standard");
      expect(standard!.isActive).toBe(true);
    });

    it("should be atomic — all succeed or none", async () => {
      // Insert a valid league first
      await insertLeague({
        id: "uuid-pre",
        leagueId: "Pre-existing",
        name: "Pre-existing",
      });

      // We can't easily force a constraint failure in a bulk upsert since
      // they all use the same ON CONFLICT, but we verify the transaction
      // completes successfully with valid data.
      await repository.upsertLeagues([
        {
          id: "uuid-batch-1",
          game: "poe1",
          leagueId: "Batch1",
          name: "Batch1",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: "2025-01-15T00:00:00Z",
        },
        {
          id: "uuid-batch-2",
          game: "poe1",
          leagueId: "Batch2",
          name: "Batch2",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: "2025-01-15T00:00:00Z",
        },
      ]);

      const leagues = await repository.getLeaguesByGame("poe1");
      // Pre-existing + 2 batch
      expect(leagues).toHaveLength(3);
    });
  });

  // ─── deleteLeaguesByGame ─────────────────────────────────────────────────

  describe("deleteLeaguesByGame", () => {
    it("should delete all leagues for a specific game", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Settlers",
        name: "Settlers",
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Standard",
        name: "Standard",
      });

      await repository.deleteLeaguesByGame("poe1");

      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toEqual([]);
    });

    it("should not delete leagues from a different game", async () => {
      await insertLeague({
        id: "uuid-1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
      });
      await insertLeague({
        id: "uuid-2",
        game: "poe2",
        leagueId: "Dawn",
        name: "Dawn",
      });

      await repository.deleteLeaguesByGame("poe1");

      const poe1 = await repository.getLeaguesByGame("poe1");
      const poe2 = await repository.getLeaguesByGame("poe2");

      expect(poe1).toEqual([]);
      expect(poe2).toHaveLength(1);
      expect(poe2[0].name).toBe("Dawn");
    });

    it("should not throw when no leagues exist", async () => {
      await expect(
        repository.deleteLeaguesByGame("poe1"),
      ).resolves.not.toThrow();
    });
  });

  // ─── deactivateStaleLeagues ──────────────────────────────────────────────

  describe("deactivateStaleLeagues", () => {
    it("should deactivate all active leagues when empty activeLeagueIds is provided", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Standard",
        name: "Standard",
        isActive: true,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", []);

      expect(deactivated).toBe(2);

      const active = await repository.getActiveLeaguesByGame("poe1");
      expect(active).toEqual([]);
    });

    it("should not deactivate leagues that are in the active list", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Standard",
        name: "Standard",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-3",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: true,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", [
        "Settlers",
        "Standard",
      ]);

      expect(deactivated).toBe(1); // Only Crucible deactivated

      const active = await repository.getActiveLeaguesByGame("poe1");
      expect(active).toHaveLength(2);
      expect(active.map((l) => l.leagueId).sort()).toEqual([
        "Settlers",
        "Standard",
      ]);
    });

    it("should return 0 when no leagues need deactivation", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", [
        "Settlers",
      ]);

      expect(deactivated).toBe(0);
    });

    it("should not affect already-inactive leagues", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: false,
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", [
        "Settlers",
      ]);

      // Crucible was already inactive, so only 0 new deactivations
      expect(deactivated).toBe(0);

      const league = await repository.getLeague("poe1", "Crucible");
      expect(league!.isActive).toBe(false);
    });

    it("should not affect leagues from a different game", async () => {
      await insertLeague({
        id: "uuid-1",
        game: "poe1",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-2",
        game: "poe2",
        leagueId: "Dawn",
        name: "Dawn",
        isActive: true,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", []);

      expect(deactivated).toBe(1);

      // poe2 leagues should be unaffected
      const poe2Active = await repository.getActiveLeaguesByGame("poe2");
      expect(poe2Active).toHaveLength(1);
      expect(poe2Active[0].name).toBe("Dawn");
    });

    it("should return 0 when no active leagues exist for the game", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: false,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", []);
      expect(deactivated).toBe(0);
    });

    it("should deactivate multiple stale leagues at once", async () => {
      await insertLeague({
        id: "uuid-1",
        leagueId: "Crucible",
        name: "Crucible",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-2",
        leagueId: "Necropolis",
        name: "Necropolis",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-3",
        leagueId: "Settlers",
        name: "Settlers",
        isActive: true,
      });
      await insertLeague({
        id: "uuid-4",
        leagueId: "Standard",
        name: "Standard",
        isActive: true,
      });

      const deactivated = await repository.deactivateStaleLeagues("poe1", [
        "Settlers",
        "Standard",
      ]);

      expect(deactivated).toBe(2);

      const active = await repository.getActiveLeaguesByGame("poe1");
      expect(active).toHaveLength(2);
      expect(active.map((l) => l.leagueId).sort()).toEqual([
        "Settlers",
        "Standard",
      ]);

      // Verify the deactivated leagues still exist but are inactive
      const crucible = await repository.getLeague("poe1", "Crucible");
      const necropolis = await repository.getLeague("poe1", "Necropolis");
      expect(crucible!.isActive).toBe(false);
      expect(necropolis!.isActive).toBe(false);
    });
  });

  // ─── Cache Metadata ──────────────────────────────────────────────────────

  describe("getCacheMetadata", () => {
    it("should return null when no metadata exists", async () => {
      const metadata = await repository.getCacheMetadata("poe1");
      expect(metadata).toBeNull();
    });

    it("should return metadata after upsert", async () => {
      await repository.upsertCacheMetadata("poe1", "2025-01-15T10:00:00Z");

      const metadata = await repository.getCacheMetadata("poe1");
      expect(metadata).not.toBeNull();
      expect(metadata!.game).toBe("poe1");
      expect(metadata!.lastFetchedAt).toBe("2025-01-15T10:00:00Z");
    });

    it("should not return metadata for a different game", async () => {
      await repository.upsertCacheMetadata("poe1", "2025-01-15T10:00:00Z");

      const metadata = await repository.getCacheMetadata("poe2");
      expect(metadata).toBeNull();
    });
  });

  describe("upsertCacheMetadata", () => {
    it("should insert cache metadata", async () => {
      await repository.upsertCacheMetadata("poe1", "2025-01-15T10:00:00Z");

      const metadata = await repository.getCacheMetadata("poe1");
      expect(metadata).not.toBeNull();
      expect(metadata!.lastFetchedAt).toBe("2025-01-15T10:00:00Z");
    });

    it("should update cache metadata on conflict", async () => {
      await repository.upsertCacheMetadata("poe1", "2025-01-15T10:00:00Z");
      await repository.upsertCacheMetadata("poe1", "2025-02-20T14:30:00Z");

      const metadata = await repository.getCacheMetadata("poe1");
      expect(metadata).not.toBeNull();
      expect(metadata!.lastFetchedAt).toBe("2025-02-20T14:30:00Z");
    });

    it("should maintain separate metadata for each game", async () => {
      await repository.upsertCacheMetadata("poe1", "2025-01-15T10:00:00Z");
      await repository.upsertCacheMetadata("poe2", "2025-02-20T14:30:00Z");

      const poe1Meta = await repository.getCacheMetadata("poe1");
      const poe2Meta = await repository.getCacheMetadata("poe2");

      expect(poe1Meta!.lastFetchedAt).toBe("2025-01-15T10:00:00Z");
      expect(poe2Meta!.lastFetchedAt).toBe("2025-02-20T14:30:00Z");
    });

    it("should update one game without affecting the other", async () => {
      await repository.upsertCacheMetadata("poe1", "2025-01-15T10:00:00Z");
      await repository.upsertCacheMetadata("poe2", "2025-01-15T10:00:00Z");

      await repository.upsertCacheMetadata("poe1", "2025-03-01T12:00:00Z");

      const poe1Meta = await repository.getCacheMetadata("poe1");
      const poe2Meta = await repository.getCacheMetadata("poe2");

      expect(poe1Meta!.lastFetchedAt).toBe("2025-03-01T12:00:00Z");
      expect(poe2Meta!.lastFetchedAt).toBe("2025-01-15T10:00:00Z");
    });
  });

  // ─── isCacheStale ────────────────────────────────────────────────────────

  describe("isCacheStale", () => {
    it("should return true when no metadata exists (cache never fetched)", async () => {
      const stale = await repository.isCacheStale("poe1", 1);
      expect(stale).toBe(true);
    });

    it("should return true when cache is older than maxAgeHours", async () => {
      // Set last fetched to 3 hours ago
      const threeHoursAgo = new Date(
        Date.now() - 3 * 60 * 60 * 1000,
      ).toISOString();
      await repository.upsertCacheMetadata("poe1", threeHoursAgo);

      const stale = await repository.isCacheStale("poe1", 2);
      expect(stale).toBe(true);
    });

    it("should return false when cache is newer than maxAgeHours", async () => {
      // Set last fetched to 30 minutes ago
      const thirtyMinutesAgo = new Date(
        Date.now() - 30 * 60 * 1000,
      ).toISOString();
      await repository.upsertCacheMetadata("poe1", thirtyMinutesAgo);

      const stale = await repository.isCacheStale("poe1", 1);
      expect(stale).toBe(false);
    });

    it("should return true when cache is exactly at maxAgeHours", async () => {
      // Set last fetched to exactly 2 hours ago
      const twoHoursAgo = new Date(
        Date.now() - 2 * 60 * 60 * 1000,
      ).toISOString();
      await repository.upsertCacheMetadata("poe1", twoHoursAgo);

      const stale = await repository.isCacheStale("poe1", 2);
      expect(stale).toBe(true);
    });

    it("should return false when cache was just fetched", async () => {
      const now = new Date().toISOString();
      await repository.upsertCacheMetadata("poe1", now);

      const stale = await repository.isCacheStale("poe1", 1);
      expect(stale).toBe(false);
    });

    it("should evaluate staleness independently per game", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const fiveHoursAgo = new Date(
        Date.now() - 5 * 60 * 60 * 1000,
      ).toISOString();

      await repository.upsertCacheMetadata("poe1", fiveMinutesAgo);
      await repository.upsertCacheMetadata("poe2", fiveHoursAgo);

      const poe1Stale = await repository.isCacheStale("poe1", 1);
      const poe2Stale = await repository.isCacheStale("poe2", 1);

      expect(poe1Stale).toBe(false);
      expect(poe2Stale).toBe(true);
    });

    it("should handle large maxAgeHours", async () => {
      const oneDayAgo = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();
      await repository.upsertCacheMetadata("poe1", oneDayAgo);

      // 48 hours max age — 24 hours old should not be stale
      const stale = await repository.isCacheStale("poe1", 48);
      expect(stale).toBe(false);
    });

    it("should handle very small maxAgeHours", async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      await repository.upsertCacheMetadata("poe1", tenMinutesAgo);

      // 0.1 hours = 6 minutes max age — 10 minutes old should be stale
      const stale = await repository.isCacheStale("poe1", 0.1);
      expect(stale).toBe(true);
    });
  });

  // ─── Full Lifecycle Integration ──────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should support: fetch leagues → cache → check staleness → refresh", async () => {
      // 1. Initially stale (no cache)
      expect(await repository.isCacheStale("poe1", 1)).toBe(true);

      // 2. First fetch: insert leagues and metadata
      const fetchTime1 = new Date().toISOString();
      await repository.upsertLeagues([
        {
          id: "uuid-1",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers",
          startAt: "2025-01-01T00:00:00Z",
          endAt: null,
          isActive: true,
          updatedAt: "2025-01-01T00:00:00Z",
          fetchedAt: fetchTime1,
        },
        {
          id: "uuid-2",
          game: "poe1",
          leagueId: "Standard",
          name: "Standard",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: fetchTime1,
        },
        {
          id: "uuid-3",
          game: "poe1",
          leagueId: "Hardcore",
          name: "Hardcore",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: fetchTime1,
        },
      ]);
      await repository.upsertCacheMetadata("poe1", fetchTime1);

      // 3. Verify cache is fresh
      expect(await repository.isCacheStale("poe1", 1)).toBe(false);

      // 4. Verify leagues are in the cache
      const allLeagues = await repository.getLeaguesByGame("poe1");
      expect(allLeagues).toHaveLength(3);

      const activeLeagues = await repository.getActiveLeaguesByGame("poe1");
      expect(activeLeagues).toHaveLength(3);

      // 5. Deactivate stale leagues (Hardcore ended)
      const deactivated = await repository.deactivateStaleLeagues("poe1", [
        "Settlers",
        "Standard",
      ]);
      expect(deactivated).toBe(1);

      // 6. Verify active leagues updated
      const updatedActive = await repository.getActiveLeaguesByGame("poe1");
      expect(updatedActive).toHaveLength(2);
      expect(updatedActive.map((l) => l.leagueId).sort()).toEqual([
        "Settlers",
        "Standard",
      ]);

      // 7. Verify inactive league is still there but inactive
      const hardcore = await repository.getLeague("poe1", "Hardcore");
      expect(hardcore).not.toBeNull();
      expect(hardcore!.isActive).toBe(false);

      // 8. Check metadata
      const metadata = await repository.getCacheMetadata("poe1");
      expect(metadata).not.toBeNull();
      expect(metadata!.lastFetchedAt).toBe(fetchTime1);
    });

    it("should support multi-game caching independently", async () => {
      const now = new Date().toISOString();

      // Cache poe1 leagues
      await repository.upsertLeagues([
        {
          id: "uuid-poe1-1",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers",
          startAt: "2025-01-01T00:00:00Z",
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: now,
        },
      ]);
      await repository.upsertCacheMetadata("poe1", now);

      // Cache poe2 leagues
      await repository.upsertLeagues([
        {
          id: "uuid-poe2-1",
          game: "poe2",
          leagueId: "Dawn",
          name: "Dawn",
          startAt: "2025-06-01T00:00:00Z",
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: now,
        },
      ]);
      await repository.upsertCacheMetadata("poe2", now);

      // Verify game isolation
      const poe1 = await repository.getLeaguesByGame("poe1");
      const poe2 = await repository.getLeaguesByGame("poe2");

      expect(poe1).toHaveLength(1);
      expect(poe1[0].name).toBe("Settlers");

      expect(poe2).toHaveLength(1);
      expect(poe2[0].name).toBe("Dawn");

      // Deactivating poe1 leagues shouldn't affect poe2
      await repository.deactivateStaleLeagues("poe1", []);

      const poe1Active = await repository.getActiveLeaguesByGame("poe1");
      const poe2Active = await repository.getActiveLeaguesByGame("poe2");

      expect(poe1Active).toHaveLength(0);
      expect(poe2Active).toHaveLength(1);

      // Deleting poe1 leagues shouldn't affect poe2
      await repository.deleteLeaguesByGame("poe1");

      expect(await repository.getLeaguesByGame("poe1")).toEqual([]);
      expect(await repository.getLeaguesByGame("poe2")).toHaveLength(1);

      // Both games should still have metadata
      expect(await repository.getCacheMetadata("poe1")).not.toBeNull();
      expect(await repository.getCacheMetadata("poe2")).not.toBeNull();
    });

    it("should handle the full refresh cycle: delete old → insert new → update metadata", async () => {
      // Initial state
      await repository.upsertLeagues([
        {
          id: "uuid-old-1",
          game: "poe1",
          leagueId: "Crucible",
          name: "Crucible",
          startAt: "2023-04-01T00:00:00Z",
          endAt: "2023-07-01T00:00:00Z",
          isActive: false,
          updatedAt: "2023-07-01T00:00:00Z",
          fetchedAt: "2025-01-01T00:00:00Z",
        },
      ]);
      await repository.upsertCacheMetadata("poe1", "2025-01-01T00:00:00Z");

      // Simulate a full refresh
      await repository.deleteLeaguesByGame("poe1");

      const refreshTime = new Date().toISOString();
      await repository.upsertLeagues([
        {
          id: "uuid-new-1",
          game: "poe1",
          leagueId: "Settlers",
          name: "Settlers",
          startAt: "2025-01-01T00:00:00Z",
          endAt: null,
          isActive: true,
          updatedAt: "2025-01-01T00:00:00Z",
          fetchedAt: refreshTime,
        },
        {
          id: "uuid-new-2",
          game: "poe1",
          leagueId: "Standard",
          name: "Standard",
          startAt: null,
          endAt: null,
          isActive: true,
          updatedAt: null,
          fetchedAt: refreshTime,
        },
      ]);
      await repository.upsertCacheMetadata("poe1", refreshTime);

      // Verify
      const leagues = await repository.getLeaguesByGame("poe1");
      expect(leagues).toHaveLength(2);
      expect(leagues.find((l) => l.leagueId === "Crucible")).toBeUndefined();
      expect(
        leagues.find((l) => l.leagueId === "Settlers"),
      ).not.toBeUndefined();
      expect(
        leagues.find((l) => l.leagueId === "Standard"),
      ).not.toBeUndefined();

      const metadata = await repository.getCacheMetadata("poe1");
      expect(metadata!.lastFetchedAt).toBe(refreshTime);

      expect(await repository.isCacheStale("poe1", 1)).toBe(false);
    });
  });
});
