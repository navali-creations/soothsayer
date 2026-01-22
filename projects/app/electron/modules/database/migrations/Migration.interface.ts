import type Database from "better-sqlite3";

/**
 * Interface for database migrations
 */
export interface Migration {
  /**
   * Unique identifier for this migration (timestamp-based recommended)
   * Format: YYYYMMDD_HHMMSS_description
   * Example: "20240115_143022_add_user_preferences"
   */
  readonly id: string;

  /**
   * Human-readable description of what this migration does
   */
  readonly description: string;

  /**
   * Execute the migration (upgrade)
   * @param db - The better-sqlite3 database instance
   */
  up(db: Database.Database): void;

  /**
   * Revert the migration (downgrade)
   * @param db - The better-sqlite3 database instance
   */
  down(db: Database.Database): void;
}
