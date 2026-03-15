import type { Kysely } from "kysely";

import type { Database } from "~/main/modules/database";

import type {
  CsvExportSnapshotDTO,
  CsvIntegrityStatus,
  SaveSnapshotEntryDTO,
} from "./Csv.dto";
import { CsvMapper } from "./Csv.mapper";

/**
 * Repository for CSV Export Snapshots
 * Handles all database operations using Kysely
 */
export class CsvRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // Snapshot Read Operations
  // ============================================================================

  /**
   * Get all snapshot rows for a given game and scope.
   */
  async getSnapshot(
    game: string,
    scope: string,
  ): Promise<CsvExportSnapshotDTO[]> {
    const rows = await this.kysely
      .selectFrom("csv_export_snapshots")
      .selectAll()
      .where("game", "=", game)
      .where("scope", "=", scope)
      .execute();

    return rows.map(CsvMapper.toSnapshotDTO);
  }

  /**
   * Get snapshot metadata (total count and last exported timestamp)
   * for a given game and scope.
   * Returns null if no snapshot exists.
   */
  async getSnapshotMeta(
    game: string,
    scope: string,
  ): Promise<{ totalCount: number; exportedAt: string } | null> {
    const row = await this.kysely
      .selectFrom("csv_export_snapshots")
      .select((eb) => [
        eb.fn.sum<number>("count").as("total_count"),
        eb.fn.max("exported_at").as("exported_at"),
      ])
      .where("game", "=", game)
      .where("scope", "=", scope)
      .executeTakeFirst();

    if (!row || row.total_count == null || row.exported_at == null) {
      return null;
    }

    return {
      totalCount: Number(row.total_count),
      exportedAt: row.exported_at as string,
    };
  }

  // ============================================================================
  // Snapshot Write Operations
  // ============================================================================

  /**
   * Save (upsert) a full snapshot for a given game and scope.
   * Overwrites any existing snapshot rows for matching (game, scope, card_name).
   *
   * @param game - "poe1" or "poe2"
   * @param scope - "all-time" or league name
   * @param entries - Array of card snapshot entries to save
   * @param integrityStatus - Optional integrity check status
   * @param integrityDetails - Optional integrity check details (JSON string)
   */
  async saveSnapshot(
    game: string,
    scope: string,
    entries: SaveSnapshotEntryDTO[],
    integrityStatus: CsvIntegrityStatus | null = null,
    integrityDetails: string | null = null,
  ): Promise<void> {
    if (entries.length === 0) return;

    const now = new Date().toISOString();
    const totalCount = entries.reduce((sum, e) => sum + e.count, 0);

    // Use upsert (INSERT ... ON CONFLICT ... DO UPDATE) for each entry
    await this.kysely.transaction().execute(async (trx) => {
      for (const entry of entries) {
        await trx
          .insertInto("csv_export_snapshots")
          .values({
            game,
            scope,
            card_name: entry.cardName,
            count: entry.count,
            total_count: totalCount,
            exported_at: now,
            integrity_status: integrityStatus,
            integrity_details: integrityDetails,
          })
          .onConflict((oc) =>
            oc.columns(["game", "scope", "card_name"]).doUpdateSet({
              count: entry.count,
              total_count: totalCount,
              exported_at: now,
              integrity_status: integrityStatus,
              integrity_details: integrityDetails,
            }),
          )
          .execute();
      }
    });
  }

  // ============================================================================
  // Snapshot Delete Operations
  // ============================================================================

  /**
   * Delete all snapshot rows for a given scope (used during league data cleanup).
   */
  async deleteSnapshotsByScope(scope: string): Promise<void> {
    await this.kysely
      .deleteFrom("csv_export_snapshots")
      .where("scope", "=", scope)
      .execute();
  }

  /**
   * Delete all snapshot rows for a given game and scope.
   */
  async deleteSnapshotsByGameAndScope(
    game: string,
    scope: string,
  ): Promise<void> {
    await this.kysely
      .deleteFrom("csv_export_snapshots")
      .where("game", "=", game)
      .where("scope", "=", scope)
      .execute();
  }

  // ============================================================================
  // Integrity Check Queries
  // ============================================================================

  /**
   * Get the sum of card counts from session_cards for all sessions of a given game.
   * Returns a Record mapping card_name → total count across all sessions.
   */
  async getSessionCardsSumByGame(
    game: string,
  ): Promise<Record<string, number>> {
    const rows = await this.kysely
      .selectFrom("session_cards as sc")
      .innerJoin("sessions as s", "sc.session_id", "s.id")
      .select([
        "sc.card_name",
        (eb) => eb.fn.sum<number>("sc.count").as("total"),
      ])
      .where("s.game", "=", game)
      .groupBy("sc.card_name")
      .execute();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.card_name] = Number(row.total);
    }
    return result;
  }

  /**
   * Get the global counter for total stacked decks opened.
   * Returns the value from global_stats where key = 'totalStackedDecksOpened'.
   */
  async getGlobalTotalDecksOpened(): Promise<number> {
    const row = await this.kysely
      .selectFrom("global_stats")
      .select("value")
      .where("key", "=", "totalStackedDecksOpened")
      .executeTakeFirst();

    return row ? Number(row.value) : 0;
  }

  /**
   * Get all-time card counts for a given game.
   * Returns a Record mapping card_name → count where scope is 'all-time'.
   */
  async getAllTimeCardCounts(game: string): Promise<Record<string, number>> {
    const rows = await this.kysely
      .selectFrom("cards")
      .select(["card_name", "count"])
      .where("game", "=", game)
      .where("scope", "=", "all-time")
      .execute();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.card_name] = Number(row.count);
    }
    return result;
  }

  /**
   * Get the sum of card counts across all leagues (non-all-time scopes) for a given game.
   * Returns a Record mapping card_name → sum of counts across all leagues.
   */
  async getLeagueCardCounts(game: string): Promise<Record<string, number>> {
    const rows = await this.kysely
      .selectFrom("cards")
      .select(["card_name", (eb) => eb.fn.sum<number>("count").as("total")])
      .where("game", "=", game)
      .where("scope", "!=", "all-time")
      .groupBy("card_name")
      .execute();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.card_name] = Number(row.total);
    }
    return result;
  }

  /**
   * Get the total count of all cards in the all-time scope for a given game.
   * Returns the sum of all card counts.
   */
  async getAllTimeTotalCount(game: string): Promise<number> {
    const row = await this.kysely
      .selectFrom("cards")
      .select((eb) => eb.fn.sum<number>("count").as("total"))
      .where("game", "=", game)
      .where("scope", "=", "all-time")
      .executeTakeFirst();

    return row ? Number(row.total) : 0;
  }
}
