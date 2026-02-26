import { migration_20260212_202200_add_audio_settings } from "./20260212_202200_add_audio_settings";
import { migration_20260213_204200_add_filter_tables_and_rarity_source } from "./20260213_204200_add_filter_tables_and_rarity_source";
import { migration_20260215_120000_add_confidence_and_unknown_rarity } from "./20260215_120000_add_confidence_and_unknown_rarity";
import { migration_20260221_201500_add_prohibited_library } from "./20260221_201500_add_prohibited_library";
import { migration_20260223_010100_add_last_seen_app_version } from "./20260223_010100_add_last_seen_app_version";
import { migration_20260225_230000_add_overlay_font_size_and_main_window_bounds } from "./20260225_230000_add_overlay_font_size_and_main_window_bounds";
import { migration_20260226_134100_add_overlay_toolbar_font_size } from "./20260226_134100_add_overlay_toolbar_font_size";
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
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
