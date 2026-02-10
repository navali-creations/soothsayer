import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { Migration } from "../migrations/Migration.interface";
import { MigrationRunner } from "../migrations/MigrationRunner";

describe("MigrationRunner", () => {
  let db: Database.Database;
  let runner: MigrationRunner;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    runner = new MigrationRunner(db);
  });

  afterEach(() => {
    db.close();
  });

  // ─── Initialization ────────────────────────────────────────────────────────

  describe("initialization", () => {
    it("should create the migrations table on construction", () => {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'",
        )
        .all() as Array<{ name: string }>;

      expect(tables).toHaveLength(1);
      expect(tables[0].name).toBe("migrations");
    });

    it("should create migrations table with correct columns", () => {
      const columns = db
        .prepare("PRAGMA table_info(migrations)")
        .all() as Array<{
        name: string;
        type: string;
      }>;

      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("description");
      expect(columnNames).toContain("applied_at");
    });

    it("should not fail if migrations table already exists", () => {
      // Creating another runner on the same DB should not throw
      expect(() => new MigrationRunner(db)).not.toThrow();
    });
  });

  // ─── Running Migrations ────────────────────────────────────────────────────

  describe("runMigrations", () => {
    it("should apply a single migration", () => {
      const migration: Migration = {
        id: "20250101_000000_test",
        description: "Test migration",
        up(db) {
          db.exec(
            "CREATE TABLE test_table (id INTEGER PRIMARY KEY, value TEXT)",
          );
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS test_table");
        },
      };

      runner.runMigrations([migration]);

      // Table should exist
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'",
        )
        .all();
      expect(tables).toHaveLength(1);

      // Migration should be recorded
      const applied = db
        .prepare("SELECT * FROM migrations WHERE id = ?")
        .get(migration.id) as
        | { id: string; description: string; applied_at: string }
        | undefined;

      expect(applied).toBeDefined();
      expect(applied!.id).toBe("20250101_000000_test");
      expect(applied!.description).toBe("Test migration");
      expect(applied!.applied_at).toBeTruthy();
    });

    it("should apply multiple migrations in order", () => {
      const migrations: Migration[] = [
        {
          id: "20250101_000001_first",
          description: "First migration",
          up(db) {
            db.exec("CREATE TABLE first_table (id INTEGER PRIMARY KEY)");
          },
          down(db) {
            db.exec("DROP TABLE IF EXISTS first_table");
          },
        },
        {
          id: "20250101_000002_second",
          description: "Second migration",
          up(db) {
            db.exec(
              "CREATE TABLE second_table (id INTEGER PRIMARY KEY, first_id INTEGER REFERENCES first_table(id))",
            );
          },
          down(db) {
            db.exec("DROP TABLE IF EXISTS second_table");
          },
        },
      ];

      runner.runMigrations(migrations);

      // Both tables should exist
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('first_table', 'second_table') ORDER BY name",
        )
        .all() as Array<{ name: string }>;

      expect(tables).toHaveLength(2);
      expect(tables[0].name).toBe("first_table");
      expect(tables[1].name).toBe("second_table");

      // Both migrations should be recorded
      const applied = db
        .prepare("SELECT id FROM migrations ORDER BY id ASC")
        .all() as Array<{ id: string }>;

      expect(applied).toHaveLength(2);
      expect(applied[0].id).toBe("20250101_000001_first");
      expect(applied[1].id).toBe("20250101_000002_second");
    });

    it("should skip already-applied migrations", () => {
      const migration: Migration = {
        id: "20250101_000000_skip_test",
        description: "Should only run once",
        up(db) {
          db.exec(
            "CREATE TABLE skip_table (id INTEGER PRIMARY KEY, value TEXT)",
          );
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS skip_table");
        },
      };

      // Run once
      runner.runMigrations([migration]);

      // Insert data so we can verify the table wasn't recreated
      db.prepare(
        "INSERT INTO skip_table (id, value) VALUES (1, 'original')",
      ).run();

      // Run again — should not throw or recreate table
      runner.runMigrations([migration]);

      // Data should still be there
      const row = db
        .prepare("SELECT value FROM skip_table WHERE id = 1")
        .get() as { value: string };
      expect(row.value).toBe("original");

      // Only one migration record
      const count = db
        .prepare("SELECT COUNT(*) as count FROM migrations")
        .get() as { count: number };
      expect(count.count).toBe(1);
    });

    it("should do nothing when migrations array is empty", () => {
      expect(() => runner.runMigrations([])).not.toThrow();

      const count = db
        .prepare("SELECT COUNT(*) as count FROM migrations")
        .get() as { count: number };
      expect(count.count).toBe(0);
    });

    it("should only apply new migrations when some are already applied", () => {
      const migration1: Migration = {
        id: "20250101_000001_existing",
        description: "Already applied",
        up(db) {
          db.exec("CREATE TABLE existing_table (id INTEGER PRIMARY KEY)");
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS existing_table");
        },
      };

      const migration2: Migration = {
        id: "20250101_000002_new",
        description: "New migration",
        up(db) {
          db.exec("CREATE TABLE new_table (id INTEGER PRIMARY KEY)");
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS new_table");
        },
      };

      // Apply only the first
      runner.runMigrations([migration1]);

      // Now apply both — only second should run
      runner.runMigrations([migration1, migration2]);

      const applied = db
        .prepare("SELECT id FROM migrations ORDER BY id ASC")
        .all() as Array<{ id: string }>;

      expect(applied).toHaveLength(2);
      expect(applied[1].id).toBe("20250101_000002_new");

      // Both tables should exist
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('existing_table', 'new_table')",
        )
        .all();
      expect(tables).toHaveLength(2);
    });

    it("should rollback all pending migrations in a batch if one fails", () => {
      const migration1: Migration = {
        id: "20250101_000001_good",
        description: "Good migration",
        up(db) {
          db.exec("CREATE TABLE good_table (id INTEGER PRIMARY KEY)");
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS good_table");
        },
      };

      const migration2: Migration = {
        id: "20250101_000002_bad",
        description: "Bad migration",
        up(_db) {
          throw new Error("Intentional failure");
        },
        down(_db) {
          // nothing
        },
      };

      expect(() => runner.runMigrations([migration1, migration2])).toThrow(
        "Intentional failure",
      );

      // Neither migration should be recorded (transaction rolled back)
      const applied = db
        .prepare("SELECT COUNT(*) as count FROM migrations")
        .get() as { count: number };
      expect(applied.count).toBe(0);

      // good_table should also not exist (rolled back)
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='good_table'",
        )
        .all();
      expect(tables).toHaveLength(0);
    });
  });

  // ─── Rollback ──────────────────────────────────────────────────────────────

  describe("rollbackMigration", () => {
    it("should rollback an applied migration", () => {
      const migration: Migration = {
        id: "20250101_000000_rollback_test",
        description: "Rollback test",
        up(db) {
          db.exec("CREATE TABLE rollback_table (id INTEGER PRIMARY KEY)");
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS rollback_table");
        },
      };

      // Apply first
      runner.runMigrations([migration]);

      // Verify table exists
      let tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='rollback_table'",
        )
        .all();
      expect(tables).toHaveLength(1);

      // Rollback
      runner.rollbackMigration(migration);

      // Table should be gone
      tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='rollback_table'",
        )
        .all();
      expect(tables).toHaveLength(0);

      // Migration record should be removed
      const applied = db
        .prepare("SELECT COUNT(*) as count FROM migrations WHERE id = ?")
        .get(migration.id) as { count: number };
      expect(applied.count).toBe(0);
    });

    it("should not throw when rolling back a migration that was not applied", () => {
      const migration: Migration = {
        id: "20250101_000000_not_applied",
        description: "Never applied",
        up(_db) {
          // nothing
        },
        down(_db) {
          // nothing
        },
      };

      // Should not throw, just warn
      expect(() => runner.rollbackMigration(migration)).not.toThrow();
    });

    it("should allow re-applying a rolled-back migration", () => {
      const migration: Migration = {
        id: "20250101_000000_reapply",
        description: "Re-apply test",
        up(db) {
          db.exec("CREATE TABLE reapply_table (id INTEGER PRIMARY KEY)");
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS reapply_table");
        },
      };

      // Apply
      runner.runMigrations([migration]);

      // Rollback
      runner.rollbackMigration(migration);

      // Re-apply
      runner.runMigrations([migration]);

      // Table should exist again
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='reapply_table'",
        )
        .all();
      expect(tables).toHaveLength(1);

      // One migration record
      const count = db
        .prepare("SELECT COUNT(*) as count FROM migrations WHERE id = ?")
        .get(migration.id) as { count: number };
      expect(count.count).toBe(1);
    });
  });

  // ─── Listing Migrations ───────────────────────────────────────────────────

  describe("listAppliedMigrations", () => {
    it("should return empty array when no migrations applied", () => {
      const result = runner.listAppliedMigrations();
      expect(result).toEqual([]);
    });

    it("should return formatted strings for applied migrations", () => {
      const migration: Migration = {
        id: "20250101_120000_add_users",
        description: "Add users table",
        up(db) {
          db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY)");
        },
        down(db) {
          db.exec("DROP TABLE IF EXISTS users");
        },
      };

      runner.runMigrations([migration]);

      const result = runner.listAppliedMigrations();
      expect(result).toHaveLength(1);
      expect(result[0]).toContain("20250101_120000_add_users");
      expect(result[0]).toContain("Add users table");
    });

    it("should list migrations in order by ID", () => {
      const migrations: Migration[] = [
        {
          id: "20250101_000002_second",
          description: "Second",
          up(db) {
            db.exec("CREATE TABLE list_b (id INTEGER PRIMARY KEY)");
          },
          down(db) {
            db.exec("DROP TABLE IF EXISTS list_b");
          },
        },
        {
          id: "20250101_000001_first",
          description: "First",
          up(db) {
            db.exec("CREATE TABLE list_a (id INTEGER PRIMARY KEY)");
          },
          down(db) {
            db.exec("DROP TABLE IF EXISTS list_a");
          },
        },
      ];

      runner.runMigrations(migrations);

      const result = runner.listAppliedMigrations();
      expect(result).toHaveLength(2);
      expect(result[0]).toContain("000001_first");
      expect(result[1]).toContain("000002_second");
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle migrations with complex SQL (indexes, constraints)", () => {
      const migration: Migration = {
        id: "20250101_000000_complex",
        description: "Complex migration with indexes and constraints",
        up(db) {
          db.exec(`
            CREATE TABLE complex_table (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              value REAL NOT NULL DEFAULT 0,
              category TEXT NOT NULL CHECK(category IN ('a', 'b', 'c')),
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              UNIQUE(name, category)
            )
          `);
          db.exec(`
            CREATE INDEX idx_complex_category ON complex_table(category)
          `);
          db.exec(`
            CREATE INDEX idx_complex_name ON complex_table(name)
          `);
        },
        down(db) {
          db.exec("DROP INDEX IF EXISTS idx_complex_name");
          db.exec("DROP INDEX IF EXISTS idx_complex_category");
          db.exec("DROP TABLE IF EXISTS complex_table");
        },
      };

      runner.runMigrations([migration]);

      // Table should exist with correct constraints
      const columns = db
        .prepare("PRAGMA table_info(complex_table)")
        .all() as Array<{
        name: string;
        notnull: number;
      }>;
      expect(columns.find((c) => c.name === "name")?.notnull).toBe(1);
      expect(columns.find((c) => c.name === "value")?.notnull).toBe(1);

      // Indexes should exist
      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='complex_table' AND name LIKE 'idx_%'",
        )
        .all() as Array<{ name: string }>;
      expect(indexes).toHaveLength(2);

      // Rollback should clean up everything
      runner.rollbackMigration(migration);

      const tablesAfter = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='complex_table'",
        )
        .all();
      expect(tablesAfter).toHaveLength(0);

      const indexesAfter = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_complex%'",
        )
        .all();
      expect(indexesAfter).toHaveLength(0);
    });

    it("should handle ALTER TABLE migrations", () => {
      // Set up a base table first
      db.exec("CREATE TABLE alter_target (id INTEGER PRIMARY KEY, name TEXT)");

      const migration: Migration = {
        id: "20250101_000000_alter",
        description: "Alter table migration",
        up(db) {
          db.exec("ALTER TABLE alter_target ADD COLUMN email TEXT");
        },
        down(db) {
          // SQLite doesn't support DROP COLUMN before 3.35.0, so recreate
          db.exec(`
            CREATE TABLE alter_target_backup AS SELECT id, name FROM alter_target;
          `);
          db.exec("DROP TABLE alter_target");
          db.exec("ALTER TABLE alter_target_backup RENAME TO alter_target");
        },
      };

      runner.runMigrations([migration]);

      const columns = db
        .prepare("PRAGMA table_info(alter_target)")
        .all() as Array<{
        name: string;
      }>;
      const columnNames = columns.map((c) => c.name);
      expect(columnNames).toContain("email");
    });

    it("should handle data migrations (INSERT/UPDATE)", () => {
      db.exec(
        "CREATE TABLE data_target (id INTEGER PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active')",
      );
      db.prepare(
        "INSERT INTO data_target (id, status) VALUES (1, 'old'), (2, 'old')",
      ).run();

      const migration: Migration = {
        id: "20250101_000000_data",
        description: "Data migration",
        up(db) {
          db.prepare(
            "UPDATE data_target SET status = 'migrated' WHERE status = 'old'",
          ).run();
        },
        down(db) {
          db.prepare(
            "UPDATE data_target SET status = 'old' WHERE status = 'migrated'",
          ).run();
        },
      };

      runner.runMigrations([migration]);

      const rows = db.prepare("SELECT status FROM data_target").all() as Array<{
        status: string;
      }>;
      expect(rows.every((r) => r.status === "migrated")).toBe(true);

      runner.rollbackMigration(migration);

      const rowsAfter = db
        .prepare("SELECT status FROM data_target")
        .all() as Array<{ status: string }>;
      expect(rowsAfter.every((r) => r.status === "old")).toBe(true);
    });
  });
});
