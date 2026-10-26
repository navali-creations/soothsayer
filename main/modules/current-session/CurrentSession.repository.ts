import type BetterSqlite3 from "better-sqlite3";
import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";

import type { GameType, KnownRarity, Rarity } from "../../../types/data-stores";
import type {
  CardEventContextUpdate,
  CreateSessionDTO,
  HistoricalCardEventCandidate,
  ProcessedIdDTO,
  SessionCardDTO,
  SessionCardEventDTO,
  SessionDTO,
  SessionSummaryDTO,
  UpdateSessionDTO,
} from "./CurrentSession.dto";
import { CurrentSessionMapper } from "./CurrentSession.mapper";

/**
 * Parameters for the synchronous addCardSync transaction.
 * Bundles all data needed for the hot-path DB writes into a single call.
 */
export interface AddCardSyncParams {
  sessionId: string;
  cardName: string;
  timestamp: string;
  eventId: string;
  localMinute: number;
  utcOffsetMinutes: number;
  location: string | null;
  chaosValue: number | null;
  divineValue: number | null;
  game: GameType;
  league: string;
  processedId: string;
}

/**
 * Repository for CurrentSession
 * Handles all database operations using Kysely
 */
export class CurrentSessionRepository {
  constructor(private kysely: Kysely<Database>) {}

  private _historicalCandidateStatement: BetterSqlite3.Statement | null = null;

  // ============================================================================
  // Synchronous Hot-Path (better-sqlite3 prepared statements)
  // ============================================================================

  /**
   * Lazily-initialized prepared statements for the synchronous card-drop path.
   * These are bound to a specific raw `better-sqlite3` Database instance.
   */
  private _syncStmts: {
    upsertSessionCard: BetterSqlite3.Statement;
    updateSessionTotal: BetterSqlite3.Statement;
    insertCardEvent: BetterSqlite3.Statement;
    insertProcessedId: BetterSqlite3.Statement;
    insertCommunityDropEvent: BetterSqlite3.Statement;
    incrementGlobalStat: BetterSqlite3.Statement;
    upsertAllTimeCard: BetterSqlite3.Statement;
    upsertLeagueCard: BetterSqlite3.Statement;
    syncTransaction: BetterSqlite3.Transaction<
      (params: AddCardSyncParams) => void
    >;
  } | null = null;

  /**
   * Lazily build and cache the prepared statements + transaction wrapper.
   */
  private getSyncStmts(db: BetterSqlite3.Database) {
    if (this._syncStmts) return this._syncStmts;

    // 1. INSERT OR UPDATE session_cards (increment count)
    const upsertSessionCard = db.prepare(`
      INSERT INTO session_cards (session_id, card_name, count, first_seen_at, last_seen_at, hide_price)
      VALUES (@sessionId, @cardName, 1, @timestamp, @timestamp, 0)
      ON CONFLICT (session_id, card_name) DO UPDATE SET
        count = count + 1,
        last_seen_at = @timestamp
    `);

    // 2. UPDATE sessions total_count
    const updateSessionTotal = db.prepare(`
      UPDATE sessions SET total_count = total_count + 1 WHERE id = @sessionId
    `);

    // 3. INSERT session_card_events (timeline event)
    const insertCardEvent = db.prepare(`
      INSERT INTO session_card_events (
        session_id,
        card_name,
        chaos_value,
        divine_value,
        dropped_at,
        event_id,
        source_event_id,
        location,
        utc_offset_minutes
      )
      VALUES (
        @sessionId,
        @cardName,
        @chaosValue,
        @divineValue,
        @timestamp,
        @eventId,
        @processedId,
        @location,
        @utcOffsetMinutes
      )
    `);

    // 4. INSERT processed_ids (save processed ID, skip duplicates)
    const insertProcessedId = db.prepare(`
      INSERT OR IGNORE INTO processed_ids (game, scope, processed_id, card_name)
      VALUES (@game, 'global', @processedId, @cardName)
    `);

    const insertCommunityDropEvent = db.prepare(`
      INSERT OR IGNORE INTO community_drop_event_outbox (
        event_id,
        session_id,
        game,
        scope,
        card_name,
        location,
        local_minute,
        utc_offset_minutes
      )
      VALUES (
        @eventId,
        @sessionId,
        @game,
        @league,
        @cardName,
        @location,
        @localMinute,
        @utcOffsetMinutes
      )
    `);

    // 5. UPDATE global_stats (increment totalStackedDecksOpened)
    const incrementGlobalStat = db.prepare(`
      UPDATE global_stats SET value = value + 1 WHERE key = 'totalStackedDecksOpened'
    `);

    // 6. INSERT OR UPDATE cards for all-time scope
    const upsertAllTimeCard = db.prepare(`
      INSERT INTO cards (game, scope, card_name, count, last_updated)
      VALUES (@game, 'all-time', @cardName, 1, @timestamp)
      ON CONFLICT (game, scope, card_name) DO UPDATE SET
        count = count + 1,
        last_updated = @timestamp
    `);

    // 7. INSERT OR UPDATE cards for league scope
    const upsertLeagueCard = db.prepare(`
      INSERT INTO cards (game, scope, card_name, count, last_updated)
      VALUES (@game, @league, @cardName, 1, @timestamp)
      ON CONFLICT (game, scope, card_name) DO UPDATE SET
        count = count + 1,
        last_updated = @timestamp
    `);

    // Bundle everything into a single synchronous transaction
    const syncTransaction = db.transaction((params: AddCardSyncParams) => {
      upsertSessionCard.run({
        sessionId: params.sessionId,
        cardName: params.cardName,
        timestamp: params.timestamp,
      });
      updateSessionTotal.run({ sessionId: params.sessionId });
      insertCardEvent.run({
        sessionId: params.sessionId,
        cardName: params.cardName,
        chaosValue: params.chaosValue,
        divineValue: params.divineValue,
        timestamp: params.timestamp,
        eventId: params.eventId,
        processedId: params.processedId,
        location: params.location,
        utcOffsetMinutes: params.utcOffsetMinutes,
      });
      insertProcessedId.run({
        game: params.game,
        processedId: params.processedId,
        cardName: params.cardName,
      });
      if (params.location) {
        insertCommunityDropEvent.run(params);
      }
      incrementGlobalStat.run();
      upsertAllTimeCard.run({
        game: params.game,
        cardName: params.cardName,
        timestamp: params.timestamp,
      });
      upsertLeagueCard.run({
        game: params.game,
        league: params.league,
        cardName: params.cardName,
        timestamp: params.timestamp,
      });
    });

    this._syncStmts = {
      upsertSessionCard,
      updateSessionTotal,
      insertCardEvent,
      insertProcessedId,
      insertCommunityDropEvent,
      incrementGlobalStat,
      upsertAllTimeCard,
      upsertLeagueCard,
      syncTransaction,
    };

    return this._syncStmts;
  }

  /**
   * Perform all hot-path card-drop DB writes in a single synchronous
   * better-sqlite3 transaction.  This replaces the sequential awaits of
   * `incrementCardCount()` + `saveProcessedId()` + `DataStore.addCard()`
   * and eliminates ~6 event-loop yields per card drop.
   *
   * @param db  The raw better-sqlite3 Database instance (from DatabaseService.getDb())
   * @param params  All data needed for the card-drop writes
   */
  addCardSync(db: BetterSqlite3.Database, params: AddCardSyncParams): void {
    const stmts = this.getSyncStmts(db);
    stmts.syncTransaction(params);
  }

  async hasHistoricalCardEventsMissingContext(
    game: GameType,
  ): Promise<boolean> {
    const row = await this.kysely
      .selectFrom("session_card_events as sce")
      .innerJoin("sessions as s", "s.id", "sce.session_id")
      .select("sce.id")
      .where("s.game", "=", game)
      .where("sce.location", "is", null)
      .where("sce.event_id", "is not", null)
      .limit(1)
      .executeTakeFirst();

    return typeof row?.id === "number";
  }

  findHistoricalCardEventCandidateSync(
    db: BetterSqlite3.Database,
    game: GameType,
    cardName: string,
    droppedAt: string,
    excludedIds: ReadonlySet<number>,
  ): HistoricalCardEventCandidate | null {
    this._historicalCandidateStatement ??= db.prepare(`
          SELECT
            sce.id,
            sce.event_id AS eventId,
            sce.session_id AS sessionId,
            sce.card_name AS cardName,
            sce.dropped_at AS droppedAt,
            l.name AS league
          FROM session_card_events sce
          JOIN sessions s ON s.id = sce.session_id
          JOIN leagues l ON l.id = s.league_id
          WHERE s.game = @game
            AND sce.card_name = @cardName
            AND sce.location IS NULL
            AND sce.event_id IS NOT NULL
            AND sce.dropped_at BETWEEN @lowerBound AND @upperBound
            AND @droppedAt >= s.started_at
            AND (
              s.ended_at IS NULL
              OR @droppedAt <= s.ended_at
            )
          ORDER BY sce.dropped_at, sce.id
          LIMIT 201
        `);

    const droppedAtMs = Date.parse(droppedAt);
    const rows = this._historicalCandidateStatement.all({
      game,
      cardName,
      droppedAt,
      lowerBound: new Date(droppedAtMs - 5_000).toISOString(),
      upperBound: new Date(droppedAtMs + 5_000).toISOString(),
    }) as Array<HistoricalCardEventCandidate & { droppedAt: string }>;

    let closest: (typeof rows)[number] | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      if (excludedIds.has(row.id)) continue;

      const distance = Math.abs(Date.parse(row.droppedAt) - droppedAtMs);
      if (
        closest === null ||
        distance < closestDistance ||
        (distance === closestDistance && row.id < closest.id)
      ) {
        closest = row;
        closestDistance = distance;
      }
    }

    if (!closest) return null;
    const { droppedAt: _candidateDroppedAt, ...candidate } = closest;
    return candidate;
  }

  applyHistoricalCardEventContextsSync(
    db: BetterSqlite3.Database,
    game: GameType,
    updates: readonly CardEventContextUpdate[],
  ): void {
    if (updates.length === 0) return;

    const updateEvent = db.prepare(`
      UPDATE session_card_events
      SET
        source_event_id = @sourceEventId,
        dropped_at = @droppedAt,
        location = @location,
        utc_offset_minutes = @utcOffsetMinutes
      WHERE id = @id AND location IS NULL
    `);
    const enqueueEvent = db.prepare(`
      INSERT OR IGNORE INTO community_drop_event_outbox (
        event_id,
        session_id,
        game,
        scope,
        card_name,
        location,
        local_minute,
        utc_offset_minutes
      )
      VALUES (
        @eventId,
        @sessionId,
        @game,
        @league,
        @cardName,
        @location,
        @localMinute,
        @utcOffsetMinutes
      )
    `);
    const transaction = db.transaction(
      (contextUpdates: readonly CardEventContextUpdate[]) => {
        for (const update of contextUpdates) {
          const result = updateEvent.run(update);
          if (result.changes > 0) {
            enqueueEvent.run({ ...update, game });
          }
        }
      },
    );

    transaction(updates);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  async createSession(data: CreateSessionDTO): Promise<void> {
    await this.kysely
      .insertInto("sessions")
      .values({
        id: data.id,
        game: data.game,
        league_id: data.leagueId,
        snapshot_id: data.snapshotId,
        started_at: data.startedAt,
        total_count: 0,
        is_active: 1,
      })
      .execute();
  }

  async updateSession(
    sessionId: string,
    data: UpdateSessionDTO,
  ): Promise<void> {
    // Build dynamic update object
    const updates: Partial<{
      total_count: number;
      ended_at: string;
      is_active: number;
    }> = {};

    if (data.totalCount !== undefined) updates.total_count = data.totalCount;
    if (data.endedAt !== undefined) updates.ended_at = data.endedAt;
    if (data.isActive !== undefined) {
      updates.is_active = CurrentSessionMapper.boolToDb(data.isActive)!;
    }

    if (Object.keys(updates).length > 0) {
      await this.kysely
        .updateTable("sessions")
        .set(updates)
        .where("id", "=", sessionId)
        .execute();
    }
  }

  async getActiveSession(game: GameType): Promise<SessionDTO | null> {
    const row = await this.kysely
      .selectFrom("sessions")
      .selectAll()
      .where("game", "=", game)
      .where("is_active", "=", 1)
      .executeTakeFirst();

    return row ? CurrentSessionMapper.toSessionDTO(row) : null;
  }

  async getSessionById(sessionId: string): Promise<SessionDTO | null> {
    const row = await this.kysely
      .selectFrom("sessions")
      .selectAll()
      .where("id", "=", sessionId)
      .executeTakeFirst();

    return row ? CurrentSessionMapper.toSessionDTO(row) : null;
  }

  async deactivateAllSessions(game: GameType): Promise<void> {
    await this.kysely
      .updateTable("sessions")
      .set({ is_active: 0 })
      .where("game", "=", game)
      .where("is_active", "=", 1)
      .execute();
  }

  async getSessionTotalCount(sessionId: string): Promise<number> {
    const result = await this.kysely
      .selectFrom("session_cards")
      .select((eb) => eb.fn.sum<number>("count").as("total"))
      .where("session_id", "=", sessionId)
      .executeTakeFirst();

    return result?.total ?? 0;
  }

  // ============================================================================
  // Session Card Operations
  // ============================================================================

  async getSessionCards(
    sessionId: string,
    filterId?: string | null,
  ): Promise<SessionCardDTO[]> {
    let query = this.kysely
      .selectFrom("session_cards as sc")
      .leftJoin("sessions as s", "sc.session_id", "s.id")
      .leftJoin("leagues as l", "s.league_id", "l.id")
      .leftJoin("divination_cards as dc", (join) =>
        join
          .onRef("dc.name", "=", "sc.card_name")
          .onRef("dc.game", "=", "s.game"),
      )
      .leftJoin("divination_card_rarities as dcr", (join) =>
        join
          .onRef("dcr.card_name", "=", "sc.card_name")
          .onRef("dcr.game", "=", "s.game")
          .onRef("dcr.league", "=", "l.name"),
      )
      .select([
        "sc.card_name as cardName",
        "sc.count",
        "sc.first_seen_at as firstSeenAt",
        "sc.last_seen_at as lastSeenAt",
        "sc.hide_price as hidePrice",
        // Divination card metadata (may be null if card not in reference data)
        "dc.id as divinationCardId",
        "dc.stack_size as stackSize",
        "dc.description",
        "dc.reward_html as rewardHtml",
        "dc.art_src as artSrc",
        "dc.flavour_html as flavourHtml",
        sql<Rarity>`COALESCE(dcr.override_rarity, dcr.rarity, 0)`.as("rarity"), // Default to 0 (Unknown) if no rarity data
        sql<Rarity | null>`dcr.prohibited_library_rarity`.as(
          "prohibitedLibraryRarity",
        ),
      ])
      .where("sc.session_id", "=", sessionId);

    // Join with filter-based rarities if a filter ID is provided
    if (filterId) {
      query = query
        .leftJoin("filter_card_rarities as fcr", (join) =>
          join
            .onRef("fcr.card_name", "=", "sc.card_name")
            .on("fcr.filter_id", "=", filterId),
        )
        .select(sql<KnownRarity | null>`fcr.rarity`.as("filterRarity"));
    } else {
      query = query.select(sql<null>`NULL`.as("filterRarity"));
    }

    const rows = await query.execute();

    return rows.map(CurrentSessionMapper.toSessionCardDTO);
  }

  async updateCardPriceVisibility(
    sessionId: string,
    cardName: string,
    hidePrice: boolean,
  ): Promise<void> {
    await this.kysely
      .updateTable("session_cards")
      .set({ hide_price: hidePrice ? 1 : 0 })
      .where("session_id", "=", sessionId)
      .where("card_name", "=", cardName)
      .execute();
  }

  // ============================================================================
  // Processed IDs Operations
  // ============================================================================

  async getProcessedIds(game: GameType): Promise<ProcessedIdDTO[]> {
    const rows = await this.kysely
      .selectFrom("processed_ids")
      .select("processed_id")
      .where("game", "=", game)
      .where("scope", "=", "global")
      .orderBy("created_at", "asc")
      .orderBy("processed_id", "asc")
      .execute();

    return rows.map((row) => ({ processedId: row.processed_id }));
  }

  async getRecentDrops(game: GameType, limit: number = 20): Promise<string[]> {
    const results = await this.kysely
      .selectFrom("processed_ids")
      .select("card_name")
      .where("game", "=", game)
      .where("scope", "=", "global")
      .where("card_name", "is not", null)
      .orderBy("processed_id", "desc")
      .limit(limit)
      .execute();

    return results.map((r) => r.card_name!);
  }

  async clearRecentDrops(game: GameType): Promise<void> {
    await this.kysely.transaction().execute(async (trx) => {
      // First, clear card_name to hide from recent drops UI
      await trx
        .updateTable("processed_ids")
        .set({ card_name: sql`NULL` })
        .where("game", "=", game)
        .where("scope", "=", "global")
        .execute();

      // Then, prune old entries - keep only the most recent 20 for deduplication
      // This prevents unbounded growth of the processed_ids table
      const keepCount = 20;

      // Get the created_at timestamp of the 20th most recent entry
      const cutoffResult = await trx
        .selectFrom("processed_ids")
        .select("created_at")
        .where("game", "=", game)
        .where("scope", "=", "global")
        .orderBy("created_at", "desc")
        .limit(1)
        .offset(keepCount - 1)
        .executeTakeFirst();

      // If we have more than keepCount entries, delete the older ones
      if (cutoffResult) {
        await trx
          .deleteFrom("processed_ids")
          .where("game", "=", game)
          .where("scope", "=", "global")
          .where("created_at", "<", cutoffResult.created_at)
          .execute();
      }
    });
  }

  // ============================================================================
  // League Operations
  // ============================================================================

  async getLeagueId(
    game: GameType,
    leagueName: string,
  ): Promise<string | null> {
    const result = await this.kysely
      .selectFrom("leagues")
      .select("id")
      .where("game", "=", game)
      .where("name", "=", leagueName)
      .executeTakeFirst();

    return result?.id ?? null;
  }

  // ============================================================================
  // Session Card Event Operations
  // ============================================================================

  async getRecentCardEvents(
    sessionId: string,
    limit = 200,
  ): Promise<SessionCardEventDTO[]> {
    // Subquery: get the most recent N events (DESC), then reverse to ASC
    const rows = await this.kysely
      .selectFrom(
        this.kysely
          .selectFrom("session_card_events")
          .selectAll()
          .where("session_id", "=", sessionId)
          .orderBy("dropped_at", "desc")
          .orderBy("id", "desc")
          .limit(limit)
          .as("recent"),
      )
      .selectAll()
      .orderBy("dropped_at", "asc")
      .orderBy("id", "asc")
      .execute();

    return rows.map(CurrentSessionMapper.toSessionCardEventDTO);
  }

  async getAllCardEvents(sessionId: string): Promise<SessionCardEventDTO[]> {
    const rows = await this.kysely
      .selectFrom("session_card_events")
      .selectAll()
      .where("session_id", "=", sessionId)
      .orderBy("dropped_at", "asc")
      .orderBy("id", "asc")
      .execute();

    return rows.map(CurrentSessionMapper.toSessionCardEventDTO);
  }

  // ============================================================================
  // Card Rarity Lookups
  // ============================================================================

  /**
   * Look up a single card's price-based rarity from divination_card_rarities.
   * Returns COALESCE(override_rarity, rarity, 0) or null if not found.
   */
  async getCardPriceRarity(
    game: GameType,
    leagueName: string,
    cardName: string,
  ): Promise<number | null> {
    const row = await this.kysely
      .selectFrom("divination_card_rarities as dcr")
      .select(
        sql<number>`COALESCE(dcr.override_rarity, dcr.rarity, 0)`.as("rarity"),
      )
      .where("dcr.card_name", "=", cardName)
      .where("dcr.game", "=", game)
      .where("dcr.league", "=", leagueName)
      .executeTakeFirst();

    return row?.rarity ?? null;
  }

  /**
   * Look up a single card's Prohibited Library weight-based rarity.
   * Returns the rarity number, including 0 (unknown), or null if not found.
   */
  async getCardProhibitedLibraryRarity(
    game: GameType,
    leagueName: string,
    cardName: string,
  ): Promise<number | null> {
    const row = await this.kysely
      .selectFrom("divination_card_rarities as dcr")
      .select("dcr.prohibited_library_rarity as rarity")
      .where("dcr.card_name", "=", cardName)
      .where("dcr.game", "=", game)
      .where("dcr.league", "=", leagueName)
      .executeTakeFirst();

    return row?.rarity ?? null;
  }

  /**
   * Look up a single card's filter-based rarity from filter_card_rarities.
   * Returns the rarity number or null if not found.
   */
  async getCardFilterRarity(
    filterId: string,
    cardName: string,
  ): Promise<number | null> {
    const row = await this.kysely
      .selectFrom("filter_card_rarities as fcr")
      .select("fcr.rarity")
      .where("fcr.filter_id", "=", filterId)
      .where("fcr.card_name", "=", cardName)
      .executeTakeFirst();

    return row?.rarity ?? null;
  }

  // ============================================================================
  // Session Summary Operations
  // ============================================================================

  /**
   * Look up a single card's full metadata from the divination_cards table.
   * Returns the metadata object or null if the card isn't in reference data.
   */
  async getDivinationCardMetadata(
    game: GameType,
    cardName: string,
  ): Promise<{
    id: string;
    stackSize: number | null;
    description: string | null;
    rewardHtml: string | null;
    artSrc: string | null;
    flavourHtml: string | null;
  } | null> {
    const row = await this.kysely
      .selectFrom("divination_cards")
      .select([
        "id",
        "stack_size as stackSize",
        "description",
        "reward_html as rewardHtml",
        "art_src as artSrc",
        "flavour_html as flavourHtml",
      ])
      .where("name", "=", cardName)
      .where("game", "=", game)
      .executeTakeFirst();

    if (!row) return null;

    return {
      id: row.id,
      stackSize: row.stackSize,
      description: row.description,
      rewardHtml: row.rewardHtml,
      artSrc: row.artSrc,
      flavourHtml: row.flavourHtml,
    };
  }

  async createSessionSummary(data: SessionSummaryDTO): Promise<void> {
    await this.kysely
      .insertInto("session_summaries")
      .values({
        session_id: data.sessionId,
        game: data.game,
        league: data.league,
        started_at: data.startedAt,
        ended_at: data.endedAt,
        duration_minutes: data.durationMinutes,
        total_decks_opened: data.totalDecksOpened,
        total_value: data.totalValue,
        net_profit: data.netProfit,
        chaos_to_divine_ratio: data.chaosToDivineRatio,
        stacked_deck_chaos_cost: data.stackedDeckChaosCost,
      })
      .execute();
  }
}
