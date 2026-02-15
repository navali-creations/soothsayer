import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";
import type { Confidence } from "~/types/data-stores";

import type {
  CreateLeagueDTO,
  CreateSnapshotDTO,
  LeagueDTO,
  SnapshotCardPriceDTO,
  SnapshotDTO,
} from "./Snapshot.dto";
import { SnapshotMapper } from "./Snapshot.mapper";

/**
 * Repository for Snapshots
 * Handles all database operations using Kysely
 */
export class SnapshotRepository {
  constructor(private kysely: Kysely<Database>) {}

  // ============================================================================
  // League Operations
  // ============================================================================

  async getLeagueByName(game: string, name: string): Promise<LeagueDTO | null> {
    const row = await this.kysely
      .selectFrom("leagues")
      .selectAll()
      .where("game", "=", game)
      .where("name", "=", name)
      .executeTakeFirst();

    return row ? SnapshotMapper.toLeagueDTO(row) : null;
  }

  async createLeague(data: CreateLeagueDTO): Promise<void> {
    await this.kysely
      .insertInto("leagues")
      .values({
        id: data.id,
        game: data.game,
        name: data.name,
        start_date: data.startDate ?? null,
      })
      .execute();
  }

  // ============================================================================
  // Snapshot Operations
  // ============================================================================

  async getRecentSnapshot(
    leagueId: string,
    hoursAgo: number,
  ): Promise<SnapshotDTO | null> {
    const row = await this.kysely
      .selectFrom("snapshots")
      .selectAll()
      .where("league_id", "=", leagueId)
      .where(
        sql`datetime(fetched_at)`,
        ">",
        sql`datetime('now', '-${sql.lit(hoursAgo)} hours')`,
      )
      .orderBy("fetched_at", "desc")
      .executeTakeFirst();

    return row ? SnapshotMapper.toSnapshotDTO(row) : null;
  }

  async getSnapshotById(snapshotId: string): Promise<SnapshotDTO | null> {
    const row = await this.kysely
      .selectFrom("snapshots")
      .selectAll()
      .where("id", "=", snapshotId)
      .executeTakeFirst();

    return row ? SnapshotMapper.toSnapshotDTO(row) : null;
  }

  async createSnapshot(data: CreateSnapshotDTO): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // Insert snapshot metadata
      await trx
        .insertInto("snapshots")
        .values({
          id: data.id,
          league_id: data.leagueId,
          fetched_at: data.snapshotData.timestamp,
          exchange_chaos_to_divine:
            data.snapshotData.exchange.chaosToDivineRatio,
          stash_chaos_to_divine: data.snapshotData.stash.chaosToDivineRatio,
          stacked_deck_chaos_cost: data.snapshotData.stackedDeckChaosCost ?? 0,
        })
        .execute();

      // Prepare card prices for batch insert
      const cardPrices: Array<{
        snapshot_id: string;
        card_name: string;
        price_source: "exchange" | "stash";
        chaos_value: number;
        divine_value: number;
        confidence: Confidence;
      }> = [];

      // Add exchange prices
      for (const [cardName, priceData] of Object.entries(
        data.snapshotData.exchange.cardPrices,
      )) {
        cardPrices.push({
          snapshot_id: data.id,
          card_name: cardName,
          price_source: "exchange",
          chaos_value: priceData.chaosValue,
          divine_value: priceData.divineValue,
          confidence: priceData.confidence ?? 1,
        });
      }

      // Add stash prices
      for (const [cardName, priceData] of Object.entries(
        data.snapshotData.stash.cardPrices,
      )) {
        cardPrices.push({
          snapshot_id: data.id,
          card_name: cardName,
          price_source: "stash",
          chaos_value: priceData.chaosValue,
          divine_value: priceData.divineValue,
          confidence: priceData.confidence ?? 1,
        });
      }

      // Batch insert card prices (more efficient than individual inserts)
      if (cardPrices.length > 0) {
        await trx
          .insertInto("snapshot_card_prices")
          .values(cardPrices)
          .execute();
      }
    });
  }

  async getSnapshotCardPrices(
    snapshotId: string,
  ): Promise<SnapshotCardPriceDTO[]> {
    const rows = await this.kysely
      .selectFrom("snapshot_card_prices")
      .selectAll()
      .where("snapshot_id", "=", snapshotId)
      .execute();

    return rows.map(SnapshotMapper.toSnapshotCardPriceDTO);
  }

  async loadSnapshot(snapshotId: string): Promise<{
    snapshot: SnapshotDTO;
    cardPrices: SnapshotCardPriceDTO[];
  } | null> {
    const snapshot = await this.getSnapshotById(snapshotId);
    if (!snapshot) {
      return null;
    }

    const cardPrices = await this.getSnapshotCardPrices(snapshotId);

    return { snapshot, cardPrices };
  }
}
