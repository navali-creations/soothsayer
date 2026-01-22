import type Database from "better-sqlite3";
import type { Migration } from "./Migration.interface";

/**
 * Migration runner that manages database schema changes
 */
export class MigrationRunner {
  constructor(private db: Database.Database) {
    this.ensureMigrationsTable();
  }

  /**
   * Create the migrations tracking table if it doesn't exist
   */
  private ensureMigrationsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  /**
   * Get list of applied migrations
   */
  private getAppliedMigrations(): Set<string> {
    const rows = this.db
      .prepare("SELECT id FROM migrations ORDER BY id ASC")
      .all() as Array<{ id: string }>;
    return new Set(rows.map((row) => row.id));
  }

  /**
   * Check if a migration has been applied
   */
  private isMigrationApplied(migrationId: string): boolean {
    const result = this.db
      .prepare("SELECT COUNT(*) as count FROM migrations WHERE id = ?")
      .get(migrationId) as { count: number };
    return result.count > 0;
  }

  /**
   * Record that a migration has been applied
   */
  private recordMigration(migration: Migration): void {
    this.db
      .prepare("INSERT INTO migrations (id, description) VALUES (?, ?)")
      .run(migration.id, migration.description);
  }

  /**
   * Remove a migration record
   */
  private removeMigrationRecord(migrationId: string): void {
    this.db.prepare("DELETE FROM migrations WHERE id = ?").run(migrationId);
  }

  /**
   * Run all pending migrations
   */
  public runMigrations(migrations: Migration[]): void {
    const appliedMigrations = this.getAppliedMigrations();
    const pendingMigrations = migrations.filter(
      (m) => !appliedMigrations.has(m.id),
    );

    if (pendingMigrations.length === 0) {
      console.log("[Migrations] ✓ No pending migrations");
      return;
    }

    console.log(
      `[Migrations] Running ${pendingMigrations.length} pending migration(s)...`,
    );

    // Run migrations in a transaction
    const transaction = this.db.transaction(() => {
      for (const migration of pendingMigrations) {
        console.log(
          `[Migrations] → Applying: ${migration.id} - ${migration.description}`,
        );
        try {
          migration.up(this.db);
          this.recordMigration(migration);
          console.log(`[Migrations] ✓ Applied: ${migration.id}`);
        } catch (error) {
          console.error(
            `[Migrations] ✗ Failed to apply ${migration.id}:`,
            error,
          );
          throw error;
        }
      }
    });

    transaction();
    console.log("[Migrations] ✓ All migrations completed successfully");
  }

  /**
   * Rollback a specific migration
   */
  public rollbackMigration(migration: Migration): void {
    if (!this.isMigrationApplied(migration.id)) {
      console.warn(
        `[Migrations] ⚠ Migration ${migration.id} is not applied, nothing to rollback`,
      );
      return;
    }

    console.log(`[Migrations] Rolling back: ${migration.id}`);

    const transaction = this.db.transaction(() => {
      migration.down(this.db);
      this.removeMigrationRecord(migration.id);
    });

    transaction();
    console.log(`[Migrations] ✓ Rolled back: ${migration.id}`);
  }

  /**
   * Get list of applied migration IDs
   */
  public listAppliedMigrations(): string[] {
    const rows = this.db
      .prepare(
        "SELECT id, description, applied_at FROM migrations ORDER BY id ASC",
      )
      .all() as Array<{ id: string; description: string; applied_at: string }>;

    return rows.map(
      (row) => `${row.id} - ${row.description} (${row.applied_at})`,
    );
  }
}
