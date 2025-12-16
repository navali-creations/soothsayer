import type { ColumnType } from "kysely";

/**
 * Database schema types for Kysely
 * These types represent the actual database structure
 *
 * ColumnType<SelectType, InsertType, UpdateType> is used for:
 * - Generated columns (e.g., created_at with DEFAULT)
 * - Auto-increment columns
 */

export interface GlobalStatsTable {
  key: string;
  value: number;
}

export interface LeaguesTable {
  id: string;
  name: string;
  game: string;
  start_date: string | null;
  end_date: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SnapshotsTable {
  id: string;
  league_id: string;
  fetched_at: string;
  exchange_chaos_to_divine: number;
  stash_chaos_to_divine: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SnapshotCardPricesTable {
  id: ColumnType<number, never, never>; // Auto-increment, can't be inserted/updated
  snapshot_id: string;
  card_name: string;
  price_source: "exchange" | "stash";
  chaos_value: number;
  divine_value: number;
  stack_size: number | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SessionsTable {
  id: string;
  game: string;
  league_id: string;
  snapshot_id: string | null;
  started_at: string;
  ended_at: string | null;
  total_count: number;
  is_active: number; // SQLite boolean (0 or 1)
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SessionCardsTable {
  id: ColumnType<number, never, never>; // Auto-increment
  session_id: string;
  card_name: string;
  count: number;
  hide_price_exchange: number; // SQLite boolean
  hide_price_stash: number; // SQLite boolean
  first_seen_at: ColumnType<string, string | undefined, never>;
  last_seen_at: ColumnType<string, string | undefined, never>;
}

export interface SessionSummariesTable {
  session_id: string;
  game: string;
  league: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  total_decks_opened: number;
  total_exchange_value: number;
  total_stash_value: number;
  exchange_chaos_to_divine: number;
  stash_chaos_to_divine: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ProcessedIdsTable {
  game: string;
  scope: string;
  processed_id: string;
  card_name: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface CardsTable {
  id: ColumnType<number, never, never>; // Auto-increment
  game: string;
  scope: string;
  card_name: string;
  count: number;
  last_updated: string | null;
}

export interface DivinationCardsTable {
  id: string; // Slug-based ID like "poe1_a-chilling-wind"
  name: string;
  stack_size: number;
  description: string;
  reward_html: string;
  art_src: string;
  flavour_html: string;
  game: "poe1" | "poe2";
  data_hash: string;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

/**
 * Main database interface
 * Maps table names to their types
 */
export interface Database {
  global_stats: GlobalStatsTable;
  leagues: LeaguesTable;
  snapshots: SnapshotsTable;
  snapshot_card_prices: SnapshotCardPricesTable;
  sessions: SessionsTable;
  session_cards: SessionCardsTable;
  session_summaries: SessionSummariesTable;
  processed_ids: ProcessedIdsTable;
  cards: CardsTable;
  divination_cards: DivinationCardsTable;
}

/**
 * Main database interface
 * Maps table names to their types
 */
export interface Database {
  global_stats: GlobalStatsTable;
  leagues: LeaguesTable;
  snapshots: SnapshotsTable;
  snapshot_card_prices: SnapshotCardPricesTable;
  sessions: SessionsTable;
  session_cards: SessionCardsTable;
  session_summaries: SessionSummariesTable;
  processed_ids: ProcessedIdsTable;
  cards: CardsTable;
}
