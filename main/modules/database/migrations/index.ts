import { migration_20240320_000001_separate_card_rarities } from "./20240320_000001_separate_card_rarities";
import { migration_20240321_000001_add_poe_leagues_cache } from "./20240321_000001_add_poe_leagues_cache";
import { migration_20240322_000001_add_installed_games } from "./20240322_000001_add_installed_games";
import type { Migration } from "./Migration.interface";

/**
 * All migrations in order
 * Add new migrations to the end of this array
 */
export const migrations: Migration[] = [
  migration_20240320_000001_separate_card_rarities,
  migration_20240321_000001_add_poe_leagues_cache,
  migration_20240322_000001_add_installed_games,
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
