import { type Kysely, sql } from "kysely";

import type { Database } from "~/main/modules/database";
import { cleanWikiMarkup } from "~/main/utils/cleanWikiMarkup";
import type { KnownRarity, Rarity } from "~/types/data-stores";

/**
 * Raw row shape for the card_price_history_cache table.
 */
export interface CardPriceHistoryCacheRow {
  id: number;
  game: string;
  league: string;
  details_id: string;
  card_name: string;
  response_data: string;
  fetched_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Repository for the local SQLite cache of poe.ninja price history data.
 *
 * Manages CRUD operations on `card_price_history_cache` to provide
 * offline support and reduce redundant API calls (30-minute TTL).
 */
export class CardDetailsRepository {
  constructor(private readonly kysely: Kysely<Database>) {}

  /**
   * Retrieve a cached price history entry for a specific card.
   *
   * @returns The cached row, or `null` if no entry exists.
   */
  async getCachedPriceHistory(
    game: string,
    league: string,
    detailsId: string,
  ): Promise<CardPriceHistoryCacheRow | null> {
    const row = await this.kysely
      .selectFrom("card_price_history_cache")
      .selectAll()
      .where("game", "=", game)
      .where("league", "=", league)
      .where("details_id", "=", detailsId)
      .executeTakeFirst();

    return (row as CardPriceHistoryCacheRow | undefined) ?? null;
  }

  /**
   * Insert or update a price history cache entry.
   *
   * Uses SQLite's `ON CONFLICT ... DO UPDATE` via the UNIQUE(game, league, details_id)
   * constraint to perform an upsert.
   */
  async upsertPriceHistory(
    game: string,
    league: string,
    detailsId: string,
    cardName: string,
    responseData: string,
    fetchedAt: string,
  ): Promise<void> {
    const now = new Date().toISOString();

    await this.kysely
      .insertInto("card_price_history_cache")
      .values({
        game,
        league,
        details_id: detailsId,
        card_name: cardName,
        response_data: responseData,
        fetched_at: fetchedAt,
        created_at: now,
        updated_at: now,
      })
      .onConflict((oc) =>
        oc.columns(["game", "league", "details_id"]).doUpdateSet({
          card_name: cardName,
          response_data: responseData,
          fetched_at: fetchedAt,
          updated_at: now,
        }),
      )
      .execute();
  }

  /**
   * Check whether a cache entry has expired.
   *
   * @param fetchedAt - ISO timestamp of when the data was originally fetched.
   * @param ttlMs - Time-to-live in milliseconds (default: 30 minutes).
   * @returns `true` if the cache entry is stale and should be refreshed.
   */
  isCacheStale(fetchedAt: string, ttlMs = 30 * 60 * 1000): boolean {
    const fetchedTime = new Date(fetchedAt).getTime();
    const now = Date.now();
    return now - fetchedTime > ttlMs;
  }

  /**
   * Delete all cached price history entries for a specific league.
   *
   * Useful for cleanup when a league ends or data is no longer relevant.
   */
  async deleteCacheForLeague(game: string, league: string): Promise<void> {
    await this.kysely
      .deleteFrom("card_price_history_cache")
      .where("game", "=", game)
      .where("league", "=", league)
      .execute();
  }

  /**
   * Delete all cached price history entries.
   */
  async deleteAll(): Promise<void> {
    await this.kysely.deleteFrom("card_price_history_cache").execute();
  }

  // ─── Personal Analytics Queries ────────────────────────────────────────────

  /**
   * Get aggregated personal stats for a card across all sessions.
   *
   * Queries `session_cards` joined with `sessions` to compute:
   * - Total drops (SUM of count)
   * - First discovered date (MIN first_seen_at)
   * - Last seen date (MAX last_seen_at)
   * - Number of distinct sessions containing this card
   */
  async getCardPersonalStats(
    game: string,
    cardName: string,
    league?: string,
  ): Promise<{
    totalDrops: number;
    firstDiscoveredAt: string | null;
    lastSeenAt: string | null;
    sessionCount: number;
  }> {
    let query = this.kysely
      .selectFrom("session_cards as sc")
      .innerJoin("sessions as s", "s.id", "sc.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        sql<number>`COALESCE(SUM(sc.count), 0)`.as("totalDrops"),
        sql<string | null>`MIN(sc.first_seen_at)`.as("firstDiscoveredAt"),
        sql<string | null>`MAX(sc.last_seen_at)`.as("lastSeenAt"),
        sql<number>`COUNT(DISTINCT sc.session_id)`.as("sessionCount"),
      ])
      .where("sc.card_name", "=", cardName)
      .where("s.game", "=", game);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const result = await query.executeTakeFirst();

    return {
      totalDrops: result?.totalDrops ?? 0,
      firstDiscoveredAt: result?.firstDiscoveredAt ?? null,
      lastSeenAt: result?.lastSeenAt ?? null,
      sessionCount: result?.sessionCount ?? 0,
    };
  }

  /**
   * Check whether a card is boss-exclusive from the divination_cards table.
   *
   * @returns `true` if the card exists and `from_boss = 1`, `false` otherwise.
   */
  async getFromBoss(game: string, cardName: string): Promise<boolean> {
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select("from_boss")
      .where("name", "=", cardName)
      .where("game", "=", game as "poe1" | "poe2")
      .executeTakeFirst();

    return result?.from_boss === 1;
  }

  /**
   * Get Prohibited Library weight data for a card.
   *
   * @returns Weight, rarity, and fromBoss data, or `null` if no PL data exists.
   */
  async getProhibitedLibraryData(
    game: string,
    league: string,
    cardName: string,
  ): Promise<{
    weight: number;
    rarity: Rarity;
    fromBoss: boolean;
  } | null> {
    const result = await this.kysely
      .selectFrom("prohibited_library_card_weights")
      .select(["weight", "rarity", "from_boss"])
      .where("card_name", "=", cardName)
      .where("game", "=", game as "poe1" | "poe2")
      .where("league", "=", league)
      .executeTakeFirst();

    if (!result) return null;

    return {
      weight: result.weight,
      rarity: result.rarity as Rarity,
      fromBoss: result.from_boss === 1,
    };
  }

  /**
   * Get per-session drop counts with timestamps for a given card.
   *
   * Returns sessions ordered chronologically (oldest first) so the
   * caller can compute cumulative totals for timeline charting.
   */
  async getDropTimeline(
    game: string,
    cardName: string,
    league?: string,
  ): Promise<
    Array<{
      sessionId: string;
      sessionStartedAt: string;
      count: number;
      totalDecksOpened: number;
      league: string;
    }>
  > {
    let query = this.kysely
      .selectFrom("session_cards as sc")
      .innerJoin("sessions as s", "s.id", "sc.session_id")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select([
        "s.id as sessionId",
        "s.started_at as sessionStartedAt",
        "sc.count as count",
        sql<number>`COALESCE(s.total_count, 0)`.as("totalDecksOpened"),
        "l.name as league",
      ])
      .where("sc.card_name", "=", cardName)
      .where("s.game", "=", game);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const rows = await query.orderBy("s.started_at", "asc").execute();

    return rows.map((row) => ({
      sessionId: row.sessionId,
      sessionStartedAt: row.sessionStartedAt,
      count: row.count,
      totalDecksOpened: row.totalDecksOpened,
      league: row.league,
    }));
  }

  /**
   * Get league date ranges for all leagues that a user has session data in
   * for a given game. Used for timeline markers and brush positioning.
   */
  async getLeagueDateRanges(game: string): Promise<
    Array<{
      name: string;
      startDate: string | null;
      endDate: string | null;
    }>
  > {
    const rows = await this.kysely
      .selectFrom("leagues as l")
      .innerJoin("sessions as s", "s.league_id", "l.id")
      .select([
        "l.name as name",
        "l.start_date as startDate",
        "l.end_date as endDate",
      ])
      .where("l.game", "=", game)
      .groupBy("l.id")
      .orderBy("l.start_date", "asc")
      .execute();

    return rows.map((row) => ({
      name: row.name,
      startDate: row.startDate ?? null,
      endDate: row.endDate ?? null,
    }));
  }

  /**
   * Get the total number of decks opened across ALL sessions for a game.
   *
   * Used to compute expected drops and luck ratio for a specific card.
   */
  async getTotalDecksOpenedAllSessions(
    game: string,
    league?: string,
  ): Promise<number> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select(sql<number>`COALESCE(SUM(s.total_count), 0)`.as("totalDecks"))
      .where("s.game", "=", game);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const result = await query.executeTakeFirst();

    return result?.totalDecks ?? 0;
  }

  /**
   * Get the start date of the user's very first session for a given game.
   *
   * Used as the timeline X-axis start bound so the drop timeline chart
   * spans the user's full history — not just from the first drop of a
   * specific card.
   *
   * @returns ISO date string of the earliest session, or `null` if no sessions exist.
   */
  async getFirstSessionStartDate(
    game: string,
    league?: string,
  ): Promise<string | null> {
    let query = this.kysely
      .selectFrom("sessions as s")
      .innerJoin("leagues as l", "s.league_id", "l.id")
      .select("s.started_at as startedAt")
      .where("s.game", "=", game);

    if (league) {
      query = query.where("l.name", "=", league);
    }

    const result = await query
      .orderBy("s.started_at", "asc")
      .limit(1)
      .executeTakeFirst();

    return result?.startedAt ?? null;
  }

  // ─── Reward Chain Resolution ───────────────────────────────────────────

  /**
   * Get the reward_html for a card by name.
   *
   * Used for reward chain resolution — when a card's reward is another
   * divination card, we need to look up that card's reward_html to
   * continue following the chain.
   *
   * @returns The reward_html string, or `null` if the card doesn't exist.
   */
  async getCardRewardHtml(
    game: string,
    cardName: string,
  ): Promise<string | null> {
    const result = await this.kysely
      .selectFrom("divination_cards")
      .select("reward_html")
      .where("name", "=", cardName)
      .where("game", "=", game as "poe1" | "poe2")
      .executeTakeFirst();

    return result?.reward_html ?? null;
  }

  // ─── Related Cards Queries ─────────────────────────────────────────────

  /**
   * Find cards that share a similar reward by doing a LIKE search on `reward_html`.
   *
   * Strips HTML tags from the reward to extract a plain-text reward item name,
   * then queries `divination_cards` for other cards whose `reward_html` contains
   * the same item name (case-insensitive). The current card is excluded.
   *
   * Also joins with `divination_card_rarities` to include rarity data, and
   * optionally with `prohibited_library_card_weights` for PL-based rarity.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param rewardItemName - Plain-text reward item name to search for
   * @param excludeCardName - The current card name to exclude from results
   * @param limit - Maximum number of related cards to return (default: 5)
   * @param plLeague - Optional league name to join PL weight-based rarity
   * @returns Array of related card data
   */
  async findCardsByRewardMatch(
    game: string,
    rewardItemName: string,
    excludeCardName: string,
    limit = 5,
    plLeague?: string,
  ): Promise<
    Array<{
      name: string;
      artSrc: string;
      stackSize: number;
      description: string;
      rewardHtml: string;
      flavourHtml: string;
      rarity: Rarity;
      filterRarity: KnownRarity | null;
      prohibitedLibraryRarity: Rarity | null;
      fromBoss: boolean;
    }>
  > {
    if (!rewardItemName || rewardItemName.trim().length < 3) {
      return [];
    }

    const searchTerm = `%${rewardItemName.trim()}%`;

    let query = this.kysely
      .selectFrom("divination_cards as dc")
      .leftJoin("divination_card_rarities as dcr", (join) =>
        join
          .onRef("dc.name", "=", "dcr.card_name")
          .onRef("dc.game", "=", "dcr.game"),
      )
      .select([
        "dc.name",
        "dc.art_src as artSrc",
        "dc.stack_size as stackSize",
        "dc.description",
        "dc.reward_html as rewardHtml",
        "dc.flavour_html as flavourHtml",
        "dc.from_boss as fromBoss",
        sql<number>`COALESCE(dcr.rarity, 0)`.as("rarity"),
      ])
      .where("dc.game", "=", game as "poe1" | "poe2")
      .where("dc.name", "!=", excludeCardName)
      .where("dc.reward_html", "like", searchTerm)
      .orderBy("dc.name", "asc")
      .limit(limit);

    if (plLeague) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query
        .leftJoin("prohibited_library_card_weights as plcw", (join) =>
          join
            .onRef("plcw.card_name", "=", "dc.name")
            .onRef("plcw.game", "=", "dc.game")
            .on("plcw.league", "=", plLeague),
        )
        .select(
          sql<number | null>`plcw.rarity`.as("prohibited_library_rarity"),
        ) as any;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.select(
        sql<null>`NULL`.as("prohibited_library_rarity"),
      ) as any;
    }

    const rows = await query.execute();

    return rows.map((row) => ({
      name: row.name,
      artSrc: row.artSrc,
      stackSize: row.stackSize,
      description: row.description ?? "",
      rewardHtml: cleanWikiMarkup(row.rewardHtml),
      flavourHtml: cleanWikiMarkup(row.flavourHtml),
      rarity: (row.rarity ?? 0) as Rarity,
      filterRarity: null, // Filter rarity requires a separate join; omitted for simplicity
      prohibitedLibraryRarity:
        (row as Record<string, unknown>).prohibited_library_rarity != null
          ? ((row as Record<string, unknown>)
              .prohibited_library_rarity as Rarity)
          : null,
      fromBoss: row.fromBoss === 1,
    }));
  }

  /**
   * Look up a single divination card by exact name.
   *
   * Used to fetch card details (art, stack size, rarity, etc.) for cards
   * discovered during reward-chain traversal so they can be included
   * as "chain" entries in the related cards section.
   *
   * Optionally joins with `prohibited_library_card_weights` for PL-based rarity.
   *
   * @param game - The game type ("poe1" or "poe2")
   * @param cardName - The exact card name to look up
   * @param plLeague - Optional league name to join PL weight-based rarity
   * @returns Card data, or `null` if not found
   */
  async findCardByName(
    game: string,
    cardName: string,
    plLeague?: string,
  ): Promise<{
    name: string;
    artSrc: string;
    stackSize: number;
    description: string;
    rewardHtml: string;
    flavourHtml: string;
    rarity: Rarity;
    filterRarity: KnownRarity | null;
    prohibitedLibraryRarity: Rarity | null;
    fromBoss: boolean;
  } | null> {
    if (!cardName || cardName.trim().length === 0) {
      return null;
    }

    let query = this.kysely
      .selectFrom("divination_cards as dc")
      .leftJoin("divination_card_rarities as dcr", (join) =>
        join
          .onRef("dc.name", "=", "dcr.card_name")
          .onRef("dc.game", "=", "dcr.game"),
      )
      .select([
        "dc.name",
        "dc.art_src as artSrc",
        "dc.stack_size as stackSize",
        "dc.description",
        "dc.reward_html as rewardHtml",
        "dc.flavour_html as flavourHtml",
        "dc.from_boss as fromBoss",
        sql<number>`COALESCE(dcr.rarity, 0)`.as("rarity"),
      ])
      .where("dc.game", "=", game as "poe1" | "poe2")
      .where("dc.name", "=", cardName);

    if (plLeague) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query
        .leftJoin("prohibited_library_card_weights as plcw", (join) =>
          join
            .onRef("plcw.card_name", "=", "dc.name")
            .onRef("plcw.game", "=", "dc.game")
            .on("plcw.league", "=", plLeague),
        )
        .select(
          sql<number | null>`plcw.rarity`.as("prohibited_library_rarity"),
        ) as any;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = query.select(
        sql<null>`NULL`.as("prohibited_library_rarity"),
      ) as any;
    }

    const row = await query.executeTakeFirst();

    if (!row) return null;

    return {
      name: row.name,
      artSrc: row.artSrc,
      stackSize: row.stackSize,
      description: row.description ?? "",
      rewardHtml: cleanWikiMarkup(row.rewardHtml),
      flavourHtml: cleanWikiMarkup(row.flavourHtml),
      rarity: (row.rarity ?? 0) as Rarity,
      filterRarity: null,
      prohibitedLibraryRarity:
        (row as Record<string, unknown>).prohibited_library_rarity != null
          ? ((row as Record<string, unknown>)
              .prohibited_library_rarity as Rarity)
          : null,
      fromBoss: row.fromBoss === 1,
    };
  }
}
