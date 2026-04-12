import { migration_20260212_202200_add_audio_settings } from "./20260212_202200_add_audio_settings";
import { migration_20260213_204200_add_filter_tables_and_rarity_source } from "./20260213_204200_add_filter_tables_and_rarity_source";
import { migration_20260215_120000_add_confidence_and_unknown_rarity } from "./20260215_120000_add_confidence_and_unknown_rarity";
import { migration_20260221_201500_add_prohibited_library } from "./20260221_201500_add_prohibited_library";
import { migration_20260223_010100_add_last_seen_app_version } from "./20260223_010100_add_last_seen_app_version";
import { migration_20260225_230000_add_overlay_font_size_and_main_window_bounds } from "./20260225_230000_add_overlay_font_size_and_main_window_bounds";
import { migration_20260226_134100_add_overlay_toolbar_font_size } from "./20260226_134100_add_overlay_toolbar_font_size";
import { migration_20260227_182400_add_stacked_deck_max_volume_rate } from "./20260227_182400_add_stacked_deck_max_volume_rate";
import { migration_20260302_192700_add_telemetry_settings } from "./20260302_192700_add_telemetry_settings";
import { migration_20260305_014700_add_card_price_history_cache } from "./20260305_014700_add_card_price_history_cache";
import { migration_20260314_131100_add_csv_export_snapshots } from "./20260314_131100_add_csv_export_snapshots";
import { migration_20260331_225900_create_session_card_events } from "./20260331_225900_create_session_card_events";
import { migration_20260405_114200_remove_autoincrement } from "./20260405_114200_remove_autoincrement";
import { migration_20260408_160000_create_availability_and_drop_from_boss } from "./20260408_160000_create_availability_and_drop_from_boss";
import { migration_20260408_170000_add_weight_to_availability } from "./20260408_170000_add_weight_to_availability";
import { migration_20260408_180000_add_pl_rarity_to_card_rarities } from "./20260408_180000_add_pl_rarity_to_card_rarities";
import { migration_20260408_190000_drop_prohibited_library_tables } from "./20260408_190000_drop_prohibited_library_tables";
import { migration_20260410_010600_index_optimization_cleanup } from "./20260410_010600_index_optimization_cleanup";
import { migration_20260412_125200_create_app_metadata } from "./20260412_125200_create_app_metadata";
import { migration_20260420_120000_add_community_uploads_enabled } from "./20260420_120000_add_community_uploads_enabled";
import type { Migration } from "./Migration.interface";

/**
 * All migrations in order
 * Add new migrations to the end of this array
 *
 * Note: All previous migrations have been folded into the baseline schema
 * in Database.service.ts. Only add NEW migrations going forward.
 */
export const migrations: Migration[] = [
  migration_20260212_202200_add_audio_settings,
  migration_20260213_204200_add_filter_tables_and_rarity_source,
  migration_20260215_120000_add_confidence_and_unknown_rarity,
  migration_20260221_201500_add_prohibited_library,
  migration_20260223_010100_add_last_seen_app_version,
  migration_20260225_230000_add_overlay_font_size_and_main_window_bounds,
  migration_20260226_134100_add_overlay_toolbar_font_size,
  migration_20260227_182400_add_stacked_deck_max_volume_rate,
  migration_20260302_192700_add_telemetry_settings,
  migration_20260305_014700_add_card_price_history_cache,
  migration_20260314_131100_add_csv_export_snapshots,
  migration_20260331_225900_create_session_card_events,
  migration_20260405_114200_remove_autoincrement,
  migration_20260408_160000_create_availability_and_drop_from_boss,
  migration_20260408_170000_add_weight_to_availability,
  migration_20260408_180000_add_pl_rarity_to_card_rarities,
  migration_20260408_190000_drop_prohibited_library_tables,
  migration_20260410_010600_index_optimization_cleanup,
  migration_20260412_125200_create_app_metadata,
  migration_20260420_120000_add_community_uploads_enabled,
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
