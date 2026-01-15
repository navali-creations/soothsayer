import { migration_20240320_000001_separate_card_rarities } from "./20240320_000001_separate_card_rarities";
import type { Migration } from "./Migration.interface";

/**
 * All migrations in order
 * Add new migrations to the end of this array
 */
export const migrations: Migration[] = [
  migration_20240320_000001_separate_card_rarities,
];

export type { Migration } from "./Migration.interface";
export { MigrationRunner } from "./MigrationRunner";
