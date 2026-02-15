import { migration_20260212_202200_add_audio_settings } from "./20260212_202200_add_audio_settings";
import { migration_20260213_204200_add_filter_tables_and_rarity_source } from "./20260213_204200_add_filter_tables_and_rarity_source";
import { migration_20260215_120000_add_confidence_and_unknown_rarity } from "./20260215_120000_add_confidence_and_unknown_rarity";
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
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
