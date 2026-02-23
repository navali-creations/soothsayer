import type { ColumnType, Selectable } from "kysely";

import type { Confidence, KnownRarity, Rarity } from "~/types/data-stores";

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
  stacked_deck_chaos_cost: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SnapshotCardPricesTable {
  id: ColumnType<number, never, never>; // Auto-increment, can't be inserted/updated
  snapshot_id: string;
  card_name: string;
  price_source: "exchange" | "stash";
  chaos_value: number;
  divine_value: number;
  confidence: ColumnType<Confidence, Confidence | undefined, Confidence>;
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
  first_seen_at: ColumnType<string, string | undefined, string | undefined>;
  last_seen_at: ColumnType<string, string | undefined, string>;
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
  total_exchange_net_profit: number | null;
  total_stash_net_profit: number | null;
  exchange_chaos_to_divine: number;
  stash_chaos_to_divine: number;
  stacked_deck_chaos_cost: number;
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
  from_boss: ColumnType<number, number | undefined, number | undefined>; // SQLite boolean (0 or 1)
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface DivinationCardRaritiesTable {
  game: "poe1" | "poe2";
  league: string;
  card_name: string;
  rarity: Rarity; // 0=unknown, 1=extremely rare, 2=rare, 3=less common, 4=common
  override_rarity: Rarity | null; // User-set rarity override for low-confidence/unknown cards; NULL = use system rarity
  last_updated: ColumnType<string, string | undefined, string | undefined>;
}

export interface PoeLeaguesCacheTable {
  id: string;
  game: "poe1" | "poe2";
  league_id: string;
  name: string;
  start_at: string | null;
  end_at: string | null;
  is_active: number; // SQLite boolean (0 or 1)
  updated_at: string | null;
  fetched_at: string;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface PoeLeaguesCacheMetadataTable {
  game: "poe1" | "poe2";
  last_fetched_at: string;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface ProhibitedLibraryCardWeightsTable {
  card_name: string;
  game: "poe1" | "poe2";
  league: string;
  weight: number;
  rarity: Rarity;
  from_boss: number; // SQLite boolean (0 or 1)
  loaded_at: string;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface ProhibitedLibraryCacheMetadataTable {
  game: "poe1" | "poe2";
  league: string;
  loaded_at: string;
  app_version: string;
  card_count: number;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface MigrationsTable {
  id: string;
  description: string;
  applied_at: ColumnType<string, string | undefined, never>;
}

export interface UserSettingsTable {
  id: ColumnType<number, never, never>; // Single row table, always id=1

  // App settings
  app_exit_action: string; // "exit" | "minimize"
  app_open_at_login: number; // SQLite boolean (0 or 1)
  app_open_at_login_minimized: number; // SQLite boolean (0 or 1)

  // Onboarding settings
  onboarding_dismissed_beacons: string; // JSON array of beacon IDs

  // Overlay settings
  overlay_bounds: string | null; // JSON string of { x, y, width, height }

  // PoE1 settings
  poe1_client_txt_path: string | null;
  poe1_selected_league: string;
  poe1_price_source: string; // "exchange" | "stash"

  // PoE2 settings
  poe2_client_txt_path: string | null;
  poe2_selected_league: string;
  poe2_price_source: string; // "exchange" | "stash"

  // Game selection
  selected_game: string; // "poe1" | "poe2"
  installed_games: string; // JSON array: '["poe1"]', '["poe2"]', or '["poe1", "poe2"]'

  // Setup and onboarding
  setup_completed: number; // SQLite boolean (0 or 1)
  setup_step: number; // 0-3
  setup_version: number;

  // Audio settings
  audio_enabled: number; // SQLite boolean (0 or 1)
  audio_volume: number; // 0.0 - 1.0
  audio_rarity1_path: string | null; // Custom sound file path for rarity 1
  audio_rarity2_path: string | null; // Custom sound file path for rarity 2
  audio_rarity3_path: string | null; // Custom sound file path for rarity 3

  // Filter / rarity source settings
  rarity_source: string; // "poe.ninja" | "filter" | "prohibited-library"
  selected_filter_id: string | null;

  // Post-update detection
  last_seen_app_version: string | null;

  // Metadata
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface FilterMetadataTable {
  id: string;
  filter_type: "local" | "online";
  file_path: string;
  filter_name: string;
  last_update: string | null;
  is_fully_parsed: number; // SQLite boolean (0 or 1)
  parsed_at: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface FilterCardRaritiesTable {
  filter_id: string;
  card_name: string;
  rarity: KnownRarity; // 1=extremely rare, 2=rare, 3=less common, 4=common (no unknown — filters always assign a tier)
  created_at: ColumnType<string, string | undefined, never>;
}

export interface UserPreferencesTable {
  id: number;
  theme: string;
  created_at: ColumnType<string, string | undefined, never>;
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
  divination_card_rarities: DivinationCardRaritiesTable;
  poe_leagues_cache: PoeLeaguesCacheTable;
  poe_leagues_cache_metadata: PoeLeaguesCacheMetadataTable;
  migrations: MigrationsTable;
  user_settings: UserSettingsTable;
  filter_metadata: FilterMetadataTable;
  filter_card_rarities: FilterCardRaritiesTable;
  prohibited_library_card_weights: ProhibitedLibraryCardWeightsTable;
  prohibited_library_cache_metadata: ProhibitedLibraryCacheMetadataTable;
}

/**
 * Selectable row types - what you get when you SELECT from a table
 * These flatten ColumnType to just the select type (first generic param)
 */
export type SessionsRow = Selectable<SessionsTable>;
export type SessionCardsRow = Selectable<SessionCardsTable>;
export type LeaguesRow = Selectable<LeaguesTable>;
export type SnapshotsRow = Selectable<SnapshotsTable>;
export type SnapshotCardPricesRow = Selectable<SnapshotCardPricesTable>;
export type DivinationCardsRow = Selectable<DivinationCardsTable>;
export type UserSettingsRow = Selectable<UserSettingsTable>;
export type PoeLeaguesCacheRow = Selectable<PoeLeaguesCacheTable>;
export type PoeLeaguesCacheMetadataRow =
  Selectable<PoeLeaguesCacheMetadataTable>;
export type FilterMetadataRow = Selectable<FilterMetadataTable>;
export type FilterCardRaritiesRow = Selectable<FilterCardRaritiesTable>;
export type ProhibitedLibraryCardWeightsRow =
  Selectable<ProhibitedLibraryCardWeightsTable>;
export type ProhibitedLibraryCacheMetadataRow =
  Selectable<ProhibitedLibraryCacheMetadataTable>;
