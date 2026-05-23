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
  chaos_to_divine_ratio: number;
  stacked_deck_chaos_cost: number;
  stacked_deck_max_volume_rate: number | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface SnapshotCardPricesTable {
  id: ColumnType<number, never, never>; // Auto-increment, can't be inserted/updated
  snapshot_id: string;
  card_name: string;
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
  hide_price: number; // SQLite boolean
  first_seen_at: ColumnType<string, string | undefined, string | undefined>;
  last_seen_at: ColumnType<string, string | undefined, string>;
}

export interface SessionCardEventsTable {
  id: ColumnType<number, never, never>;
  session_id: string;
  card_name: string;
  chaos_value: number | null;
  divine_value: number | null;
  dropped_at: ColumnType<string, string | undefined, never>;
}

export interface SessionSummariesTable {
  session_id: string;
  game: string;
  league: string;
  started_at: string;
  ended_at: string;
  duration_minutes: number;
  total_decks_opened: number;
  total_value: number;
  net_profit: number | null;
  chaos_to_divine_ratio: number;
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
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface DivinationCardAvailabilityTable {
  game: "poe1" | "poe2";
  league: string;
  card_name: string;
  from_boss: ColumnType<number, number | undefined, number | undefined>;
  is_disabled: ColumnType<number, number | undefined, number | undefined>;
  weight: ColumnType<
    number | null,
    number | null | undefined,
    number | null | undefined
  >;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface DivinationCardRaritiesTable {
  game: "poe1" | "poe2";
  league: string;
  card_name: string;
  rarity: Rarity; // 0=unknown, 1=extremely rare, 2=rare, 3=less common, 4=common
  override_rarity: Rarity | null; // User-set rarity override for low-confidence/unknown cards; NULL = use system rarity
  prohibited_library_rarity: Rarity | null;
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

  // PoE2 settings
  poe2_client_txt_path: string | null;
  poe2_selected_league: string;

  // Game selection
  selected_game: string; // "poe1" | "poe2"
  installed_games: string; // JSON array: '["poe1"]', '["poe2"]', or '["poe1", "poe2"]'

  // Setup and onboarding
  setup_completed: number; // SQLite boolean (0 or 1)
  setup_step: number; // 0-4
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

  // Telemetry settings
  telemetry_crash_reporting: number; // SQLite boolean (0 or 1)
  telemetry_usage_analytics: number; // SQLite boolean (0 or 1)

  // Post-update detection
  last_seen_app_version: string | null;

  // Overlay customization
  overlay_font_size: number; // 0.5–2.0, default 1.0
  overlay_toolbar_font_size: number; // 0.5–2.0, default 1.0

  // Main window position persistence
  main_window_bounds: string | null; // JSON string of { x, y, width, height }

  // CSV export settings
  csv_export_path: string | null; // User-configurable directory for CSV exports

  // Community uploads
  community_uploads_enabled: number; // SQLite boolean (0 or 1) — default 1 (enabled)

  // App performance diagnostics
  app_performance_monitor_enabled: number; // SQLite boolean (0 or 1) — default 0 (disabled)
  app_performance_auto_start_on_session: number; // SQLite boolean (0 or 1) — default 0 (disabled)
  app_performance_retention: string; // "24h" | "7d" | "indefinite"

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

export interface FilterTierStylesTable {
  filter_id: string;
  rarity: KnownRarity;
  bg_r: number | null;
  bg_g: number | null;
  bg_b: number | null;
  bg_a: number | null;
  text_r: number | null;
  text_g: number | null;
  text_b: number | null;
  text_a: number | null;
  border_r: number | null;
  border_g: number | null;
  border_b: number | null;
  border_a: number | null;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
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
export interface CardPriceHistoryCacheTable {
  id: ColumnType<number, never, never>; // Auto-increment
  game: string; // "poe1" | "poe2"
  league: string;
  details_id: string;
  card_name: string;
  response_data: string; // JSON blob of CardPriceHistoryDTO
  fetched_at: string; // ISO timestamp of original poe.ninja fetch
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface CsvExportSnapshotsTable {
  id: ColumnType<number, never, never>; // Auto-increment
  game: string; // "poe1" | "poe2"
  scope: string; // "all-time" or league name
  card_name: string;
  count: number; // Snapshot count at time of export
  total_count: number; // Total cards exported so far (running total for this game+scope)
  exported_at: string; // ISO timestamp of the export
  integrity_status: string | null; // "pass" | "warn" | "fail" | null
  integrity_details: string | null; // JSON string with check details, or null
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string | undefined>;
}

export interface AppMetadataTable {
  key: string;
  value: string;
}

export interface CommunityUploadSnapshotTable {
  game: string;
  scope: string;
  card_name: string;
  count: number;
}

export interface CommunityUploadOutboxTable {
  game: string;
  scope: string;
  cards_json: string;
  attempts: ColumnType<number, number | undefined, number>;
  last_error: string | null;
  next_attempt_at: string | null;
  created_at: ColumnType<string, string | undefined, never>;
  updated_at: ColumnType<string, string | undefined, string>;
}

export interface DismissedBannersTable {
  banner_id: string;
  dismissed_at: ColumnType<string, string | undefined, string>;
}

export interface AppPerformanceCapturesTable {
  id: string;
  started_at: string;
  stopped_at: string | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface AppPerformanceSamplesTable {
  id: ColumnType<number, never, never>;
  collection_id: string;
  sampled_at: string;
  uptime_ms: number;
  capture_elapsed_ms: number;
  route: string | null;
  fps: number | null;
  system_cpu_percent: number | null;
  app_cpu_percent: number | null;
  system_memory_used_percent: number | null;
  system_memory_total_bytes: number | null;
  system_memory_free_bytes: number | null;
  app_memory_bytes: number | null;
  app_memory_percent: number | null;
  main_heap_used_bytes: number | null;
  renderer_memory_bytes: number | null;
  renderer_heap_used_bytes: number | null;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface AppPerformanceRouteMarkersTable {
  id: string;
  collection_id: string;
  route: string;
  label: string;
  marked_at: string;
  elapsed_ms: number;
  created_at: ColumnType<string, string | undefined, never>;
}

export interface Database {
  app_metadata: AppMetadataTable;
  global_stats: GlobalStatsTable;
  leagues: LeaguesTable;
  snapshots: SnapshotsTable;
  snapshot_card_prices: SnapshotCardPricesTable;
  sessions: SessionsTable;
  session_cards: SessionCardsTable;
  session_card_events: SessionCardEventsTable;
  session_summaries: SessionSummariesTable;
  processed_ids: ProcessedIdsTable;
  cards: CardsTable;
  divination_cards: DivinationCardsTable;
  divination_card_rarities: DivinationCardRaritiesTable;
  divination_card_availability: DivinationCardAvailabilityTable;
  poe_leagues_cache: PoeLeaguesCacheTable;
  poe_leagues_cache_metadata: PoeLeaguesCacheMetadataTable;
  card_price_history_cache: CardPriceHistoryCacheTable;
  csv_export_snapshots: CsvExportSnapshotsTable;
  community_upload_snapshot: CommunityUploadSnapshotTable;
  community_upload_outbox: CommunityUploadOutboxTable;
  dismissed_banners: DismissedBannersTable;
  app_performance_captures: AppPerformanceCapturesTable;
  app_performance_samples: AppPerformanceSamplesTable;
  app_performance_route_markers: AppPerformanceRouteMarkersTable;
  migrations: MigrationsTable;
  user_settings: UserSettingsTable;
  filter_metadata: FilterMetadataTable;
  filter_card_rarities: FilterCardRaritiesTable;
  filter_tier_styles: FilterTierStylesTable;
}

/**
 * Selectable row types - what you get when you SELECT from a table
 * These flatten ColumnType to just the select type (first generic param)
 */
export type SessionsRow = Selectable<SessionsTable>;
export type SessionCardsRow = Selectable<SessionCardsTable>;
export type SessionCardEventsRow = Selectable<SessionCardEventsTable>;
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
export type FilterTierStylesRow = Selectable<FilterTierStylesTable>;
export type CardPriceHistoryCacheRow = Selectable<CardPriceHistoryCacheTable>;
export type CsvExportSnapshotsRow = Selectable<CsvExportSnapshotsTable>;
