import { migration_20260212_202200_add_audio_settings } from "./20260212_202200_add_audio_settings";
import type { Migration } from "./Migration.interface";

/**
 * All migrations in order
 * Add new
 migrations to the end of this array
 *
 * Note: All previous migrations have been folded into the baseline schema
 * in Database.service.ts. Only add NEW migrations going forward.
 */
export const migrations: Migration[] = [
  migration_20260212_202200_add_audio_settings,
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
