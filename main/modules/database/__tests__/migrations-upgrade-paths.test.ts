import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

import { MigrationRunner, migrations } from "../migrations";
import { migration_20260221_201500_add_prohibited_library } from "../migrations/20260221_201500_add_prohibited_library";
import {
  createBaselineSchema,
  createPreAudioSchema,
  createPreFilterSchema,
  EXPECTED_AUDIO_COLUMNS,
  EXPECTED_AVAILABILITY_COLUMNS,
  EXPECTED_FILTER_CARD_RARITIES_COLUMNS,
  EXPECTED_FILTER_METADATA_COLUMNS,
  EXPECTED_FILTER_SETTINGS_COLUMNS,
  EXPECTED_FILTER_TABLES,
  getColumnNames,
  getTableNames,
  setupMigrationDb,
} from "./migrations-shared";

describe("Migrations – Upgrade Paths", () => {
  const { getDb } = setupMigrationDb();

  describe("upgrade (pre-audio schema + migrations)", () => {
    it("should run all migrations without errors on an older database", () => {
      const db = getDb();
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
    });

    it("should have last_seen_app_version column after upgrade from pre-audio", () => {
      const db = getDb();
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("last_seen_app_version");
    });

    it("should add all audio columns to user_settings", () => {
      const db = getDb();
      createPreAudioSchema(db);

      // Verify columns don't exist yet
      const before = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(before).not.toContain(col);
      }

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify columns now exist
      const after = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(after).toContain(col);
      }
    });

    it("should set correct default values for new audio columns", () => {
      const db = getDb();
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT audio_enabled, audio_volume, audio_rarity1_path, audio_rarity2_path, audio_rarity3_path FROM user_settings WHERE id = 1",
        )
        .get() as {
        audio_enabled: number;
        audio_volume: number;
        audio_rarity1_path: string | null;
        audio_rarity2_path: string | null;
        audio_rarity3_path: string | null;
      };

      expect(row.audio_enabled).toBe(1);
      expect(row.audio_volume).toBe(0.5);
      expect(row.audio_rarity1_path).toBeNull();
      expect(row.audio_rarity2_path).toBeNull();
      expect(row.audio_rarity3_path).toBeNull();
    });

    it("should also add filter tables and columns during pre-audio upgrade", () => {
      const db = getDb();
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Filter tables should exist
      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }

      // Filter settings columns should exist
      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }
    });

    it("should default last_seen_app_version to NULL after pre-audio upgrade", () => {
      const db = getDb();
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare("SELECT last_seen_app_version FROM user_settings WHERE id = 1")
        .get() as { last_seen_app_version: string | null };

      expect(row.last_seen_app_version).toBeNull();
    });

    it("should preserve existing user settings during upgrade", () => {
      const db = getDb();
      createPreAudioSchema(db);

      db.prepare(
        "UPDATE user_settings SET app_exit_action = 'minimize', poe1_selected_league = 'Settlers' WHERE id = 1",
      ).run();

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT app_exit_action, poe1_selected_league, audio_enabled FROM user_settings WHERE id = 1",
        )
        .get() as {
        app_exit_action: string;
        poe1_selected_league: string;
        audio_enabled: number;
      };

      expect(row.app_exit_action).toBe("minimize");
      expect(row.poe1_selected_league).toBe("Settlers");
      expect(row.audio_enabled).toBe(1);
    });
  });

  // ─── Upgrade from Pre-Filter Version (has audio, no filters) ───────────

  describe("upgrade (pre-filter schema + filter migration)", () => {
    it("should have last_seen_app_version column after upgrade from pre-filter", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const columns = getColumnNames(db, "user_settings");
      expect(columns).toContain("last_seen_app_version");
    });

    it("should run all migrations without errors on a pre-filter database", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations(migrations)).not.toThrow();
    });

    it("should create filter_metadata table", () => {
      const db = getDb();
      createPreFilterSchema(db);

      // Verify table doesn't exist yet
      const beforeTables = getTableNames(db);
      expect(beforeTables).not.toContain("filter_metadata");

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify table now exists with correct columns
      const afterTables = getTableNames(db);
      expect(afterTables).toContain("filter_metadata");

      const columns = getColumnNames(db, "filter_metadata");
      expect(columns.sort()).toEqual(EXPECTED_FILTER_METADATA_COLUMNS.sort());
    });

    it("should create filter_card_rarities table", () => {
      const db = getDb();
      createPreFilterSchema(db);

      // Verify table doesn't exist yet
      const beforeTables = getTableNames(db);
      expect(beforeTables).not.toContain("filter_card_rarities");

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify table now exists with correct columns
      const afterTables = getTableNames(db);
      expect(afterTables).toContain("filter_card_rarities");

      const columns = getColumnNames(db, "filter_card_rarities");
      expect(columns.sort()).toEqual(
        EXPECTED_FILTER_CARD_RARITIES_COLUMNS.sort(),
      );
    });

    it("should add rarity_source and selected_filter_id columns to user_settings", () => {
      const db = getDb();
      createPreFilterSchema(db);

      // Verify columns don't exist yet
      const before = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(before).not.toContain(col);
      }

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify columns now exist
      const after = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(after).toContain(col);
      }
    });

    it("should set correct default values for rarity_source and selected_filter_id", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT rarity_source, selected_filter_id FROM user_settings WHERE id = 1",
        )
        .get() as {
        rarity_source: string;
        selected_filter_id: string | null;
      };

      expect(row.rarity_source).toBe("poe.ninja");
      expect(row.selected_filter_id).toBeNull();
    });

    it("should preserve existing user settings during filter upgrade", () => {
      const db = getDb();
      createPreFilterSchema(db);

      db.prepare(
        "UPDATE user_settings SET app_exit_action = 'minimize', audio_volume = 0.8, poe1_selected_league = 'Keepers' WHERE id = 1",
      ).run();

      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const row = db
        .prepare(
          "SELECT app_exit_action, audio_volume, poe1_selected_league, rarity_source FROM user_settings WHERE id = 1",
        )
        .get() as {
        app_exit_action: string;
        audio_volume: number;
        poe1_selected_league: string;
        rarity_source: string;
      };

      expect(row.app_exit_action).toBe("minimize");
      expect(row.audio_volume).toBe(0.8);
      expect(row.poe1_selected_league).toBe("Keepers");
      expect(row.rarity_source).toBe("poe.ninja");
    });

    it("should enforce rarity_source CHECK constraint", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid values should work
      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'filter' WHERE id = 1",
          )
          .run(),
      ).not.toThrow();

      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'prohibited-library' WHERE id = 1",
          )
          .run(),
      ).not.toThrow();

      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'poe.ninja' WHERE id = 1",
          )
          .run(),
      ).not.toThrow();

      // Invalid value should throw
      expect(() =>
        db
          .prepare(
            "UPDATE user_settings SET rarity_source = 'invalid' WHERE id = 1",
          )
          .run(),
      ).toThrow();
    });

    it("should enforce filter_metadata CHECK constraints", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid filter_type values
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/to/filter.filter', 'Test Filter')",
          )
          .run(),
      ).not.toThrow();

      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f2', 'online', '/path/to/online-filter', 'Online Filter')",
          )
          .run(),
      ).not.toThrow();

      // Invalid filter_type should throw
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f3', 'custom', '/path/to/custom', 'Custom')",
          )
          .run(),
      ).toThrow();
    });

    it("should enforce filter_card_rarities rarity CHECK constraint", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a filter first
      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Test')",
      ).run();

      // Valid rarity values (1-4)
      for (let rarity = 1; rarity <= 4; rarity++) {
        expect(() =>
          db
            .prepare(
              `INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Card ${rarity}', ${rarity})`,
            )
            .run(),
        ).not.toThrow();
      }

      // Invalid rarity values
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Bad Card 0', 0)",
          )
          .run(),
      ).toThrow();

      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Bad Card 5', 5)",
          )
          .run(),
      ).toThrow();
    });

    it("should cascade delete filter_card_rarities when filter_metadata is deleted", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a filter and some card rarities
      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Test')",
      ).run();
      db.prepare(
        "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'The Doctor', 1)",
      ).run();
      db.prepare(
        "INSERT INTO filter_card_rarities (filter_id, card_name, rarity) VALUES ('f1', 'Rain of Chaos', 4)",
      ).run();

      // Verify rarities exist
      const before = db
        .prepare(
          "SELECT COUNT(*) as count FROM filter_card_rarities WHERE filter_id = 'f1'",
        )
        .get() as { count: number };
      expect(before.count).toBe(2);

      // Delete the filter
      db.prepare("DELETE FROM filter_metadata WHERE id = 'f1'").run();

      // Rarities should be cascade deleted
      const after = db
        .prepare(
          "SELECT COUNT(*) as count FROM filter_card_rarities WHERE filter_id = 'f1'",
        )
        .get() as { count: number };
      expect(after.count).toBe(0);
    });

    it("should set selected_filter_id to NULL when referenced filter is deleted", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Insert a filter
      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Test')",
      ).run();

      // Set it as the selected filter
      db.prepare(
        "UPDATE user_settings SET selected_filter_id = 'f1', rarity_source = 'filter' WHERE id = 1",
      ).run();

      // Verify it's set
      const before = db
        .prepare("SELECT selected_filter_id FROM user_settings WHERE id = 1")
        .get() as { selected_filter_id: string | null };
      expect(before.selected_filter_id).toBe("f1");

      // Delete the filter
      db.prepare("DELETE FROM filter_metadata WHERE id = 'f1'").run();

      // selected_filter_id should be NULL (ON DELETE SET NULL)
      const after = db
        .prepare("SELECT selected_filter_id FROM user_settings WHERE id = 1")
        .get() as { selected_filter_id: string | null };
      expect(after.selected_filter_id).toBeNull();
    });

    it("should enforce unique file_path in filter_metadata", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      db.prepare(
        "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f1', 'local', '/path/filter.filter', 'Filter 1')",
      ).run();

      // Same file_path with different id should throw
      expect(() =>
        db
          .prepare(
            "INSERT INTO filter_metadata (id, filter_type, file_path, filter_name) VALUES ('f2', 'local', '/path/filter.filter', 'Filter 2')",
          )
          .run(),
      ).toThrow();
    });
  });

  // ─── Rollback ──────────────────────────────────────────────────────────

  describe("rollback", () => {
    it("should successfully roll back availability migration", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify table exists before rollback
      const beforeTables = getTableNames(db);
      expect(beforeTables).toContain("divination_card_availability");

      // Find and rollback the availability migration
      const availMigration = migrations.find((m) =>
        m.id.includes("create_availability_and_drop_from_boss"),
      )!;
      expect(() => runner.rollbackMigration(availMigration)).not.toThrow();

      // Verify table is removed and from_boss is restored on divination_cards
      const afterTables = getTableNames(db);
      expect(afterTables).not.toContain("divination_card_availability");

      const afterColumns = getColumnNames(db, "divination_cards");
      expect(afterColumns).toContain("from_boss");
    });

    it("should allow re-applying availability migration after rollback", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      const availMigration = migrations.find((m) =>
        m.id.includes("create_availability_and_drop_from_boss"),
      )!;
      runner.rollbackMigration(availMigration);

      // Re-apply
      expect(() => runner.runMigrations([availMigration])).not.toThrow();

      const tables = getTableNames(db);
      expect(tables).toContain("divination_card_availability");

      // from_boss should be dropped from divination_cards again
      const columns = getColumnNames(db, "divination_cards");
      expect(columns).not.toContain("from_boss");
    });

    it("should successfully roll back all migrations", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      for (const m of [...migrations].reverse()) {
        expect(() => runner.rollbackMigration(m)).not.toThrow();
      }

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(columns).not.toContain(col);
      }
    });

    it("should remove filter tables on rollback", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Verify tables exist after migration
      const beforeTables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(beforeTables).toContain(table);
      }

      // Rollback the filter migration (second migration)
      const filterMigration = migrations.find((m) =>
        m.id.includes("add_filter_tables"),
      );
      expect(filterMigration).toBeDefined();
      runner.rollbackMigration(filterMigration!);

      // Filter tables should be gone
      const afterTables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(afterTables).not.toContain(table);
      }

      // Filter settings columns should be gone
      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).not.toContain(col);
      }
    });

    it("should allow re-applying migrations after rollback", () => {
      const db = getDb();
      createPreAudioSchema(db);
      const runner = new MigrationRunner(db);

      // Apply
      runner.runMigrations(migrations);

      // Rollback all
      for (const migration of [...migrations].reverse()) {
        runner.rollbackMigration(migration);
      }

      // Re-apply
      expect(() => runner.runMigrations(migrations)).not.toThrow();

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_AUDIO_COLUMNS) {
        expect(columns).toContain(col);
      }
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }

      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }
    });

    it("should allow re-applying filter migration after rollback", () => {
      const db = getDb();
      createPreFilterSchema(db);
      const runner = new MigrationRunner(db);

      // Apply
      runner.runMigrations(migrations);

      // Rollback filter migration only
      const filterMigration = migrations.find((m) =>
        m.id.includes("add_filter_tables"),
      );
      expect(filterMigration).toBeDefined();
      runner.rollbackMigration(filterMigration!);

      // Re-apply
      expect(() => runner.runMigrations(migrations)).not.toThrow();

      const tables = getTableNames(db);
      for (const table of EXPECTED_FILTER_TABLES) {
        expect(tables).toContain(table);
      }

      const columns = getColumnNames(db, "user_settings");
      for (const col of EXPECTED_FILTER_SETTINGS_COLUMNS) {
        expect(columns).toContain(col);
      }
    });
  });

  // ─── Prohibited Library-specific tests ─────────────────────────────

  describe("divination_card_availability constraints", () => {
    it("should enforce game CHECK constraint on divination_card_availability", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid game
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'The Doctor', 0, 0)`,
          )
          .run(),
      ).not.toThrow();

      // Invalid game
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe3', 'Keepers', 'House of Mirrors', 0, 0)`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce from_boss CHECK constraint on divination_card_availability", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid: 0
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'The Doctor', 0, 0)`,
          )
          .run(),
      ).not.toThrow();

      // Valid: 1
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'House of Mirrors', 1, 0)`,
          )
          .run(),
      ).not.toThrow();

      // Invalid: 2
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'Rain of Chaos', 2, 0)`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce is_disabled CHECK constraint on divination_card_availability", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // Valid: 0
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'The Doctor', 0, 0)`,
          )
          .run(),
      ).not.toThrow();

      // Valid: 1
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'House of Mirrors', 0, 1)`,
          )
          .run(),
      ).not.toThrow();

      // Invalid: 2
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'Rain of Chaos', 0, 2)`,
          )
          .run(),
      ).toThrow();
    });

    it("should enforce primary key (game, league, card_name) on divination_card_availability", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      db.prepare(
        `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
         VALUES ('poe1', 'Keepers', 'The Doctor', 0, 0)`,
      ).run();

      // Same game, same league, same card_name → should fail
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Keepers', 'The Doctor', 1, 0)`,
          )
          .run(),
      ).toThrow();

      // Same game, different league → should succeed
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
             VALUES ('poe1', 'Dawn', 'The Doctor', 0, 0)`,
          )
          .run(),
      ).not.toThrow();
    });

    it("should allow NULL weight on divination_card_availability", () => {
      const db = getDb();
      createBaselineSchema(db);
      const runner = new MigrationRunner(db);
      runner.runMigrations(migrations);

      // weight defaults to NULL
      db.prepare(
        `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled)
         VALUES ('poe1', 'Keepers', 'The Doctor', 0, 0)`,
      ).run();

      const row = db
        .prepare(
          "SELECT weight FROM divination_card_availability WHERE card_name = 'The Doctor'",
        )
        .get() as { weight: number | null };
      expect(row.weight).toBeNull();

      // Explicit weight should work
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_card_availability (game, league, card_name, from_boss, is_disabled, weight)
             VALUES ('poe1', 'Keepers', 'House of Mirrors', 0, 0, 100)`,
          )
          .run(),
      ).not.toThrow();
    });
  });

  describe("prohibited library migration (in isolation)", () => {
    it("should enforce from_boss CHECK constraint on divination_cards (PL migration in isolation)", () => {
      const db = getDb();
      createBaselineSchema(db);
      // Run only the PL migration so from_boss exists on divination_cards
      migration_20260221_201500_add_prohibited_library.up(db);

      // Valid: 0
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, from_boss)
             VALUES ('poe1_the-doctor', 'The Doctor', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash1', 0)`,
          )
          .run(),
      ).not.toThrow();

      // Valid: 1
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, from_boss)
             VALUES ('poe1_house-of-mirrors', 'House of Mirrors', 2, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash2', 1)`,
          )
          .run(),
      ).not.toThrow();

      // Invalid: 2
      expect(() =>
        db
          .prepare(
            `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, from_boss)
             VALUES ('poe1_rain-of-chaos', 'Rain of Chaos', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash3', 2)`,
          )
          .run(),
      ).toThrow();
    });

    it("should default from_boss to 0 on divination_cards (PL migration in isolation)", () => {
      const db = getDb();
      createBaselineSchema(db);
      // Run only the PL migration so from_boss exists on divination_cards
      migration_20260221_201500_add_prohibited_library.up(db);

      db.prepare(
        `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash)
         VALUES ('poe1_the-doctor', 'The Doctor', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash1')`,
      ).run();

      const row = db
        .prepare(
          "SELECT from_boss FROM divination_cards WHERE id = 'poe1_the-doctor'",
        )
        .get() as { from_boss: number };
      expect(row.from_boss).toBe(0);
    });

    it("should preserve existing divination_cards data when adding from_boss (PL migration in isolation)", () => {
      const db = getDb();
      createBaselineSchema(db);

      // Insert a card BEFORE the prohibited library migration runs
      db.prepare(
        `INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash)
         VALUES ('poe1_the-doctor', 'The Doctor', 8, 'desc', '<p>reward</p>', 'art.png', '<p>flavour</p>', 'poe1', 'hash1')`,
      ).run();

      // Now run only the prohibited library migration
      migration_20260221_201500_add_prohibited_library.up(db);

      // Card should still exist with from_boss defaulted to 0
      const row = db
        .prepare(
          "SELECT id, name, stack_size, from_boss FROM divination_cards WHERE id = 'poe1_the-doctor'",
        )
        .get() as {
        id: string;
        name: string;
        stack_size: number;
        from_boss: number;
      };
      expect(row.id).toBe("poe1_the-doctor");
      expect(row.name).toBe("The Doctor");
      expect(row.stack_size).toBe(8);
      expect(row.from_boss).toBe(0);
    });
  });

  describe("schema consistency", () => {
    it("should produce the same user_settings columns whether fresh install or upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "user_settings").sort();
      freshDb.close();

      // Upgrade from pre-audio
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings").sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same user_settings columns whether fresh install or pre-filter upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "user_settings").sort();
      freshDb.close();

      // Upgrade from pre-filter
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreFilterSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings").sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same filter_metadata columns whether fresh install or pre-filter upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "filter_metadata").sort();
      freshDb.close();

      // Upgrade from pre-filter
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreFilterSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "filter_metadata",
      ).sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should produce the same filter_card_rarities columns whether fresh install or pre-filter upgrade", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(
        freshDb,
        "filter_card_rarities",
      ).sort();
      freshDb.close();

      // Upgrade from pre-filter
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreFilterSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "filter_card_rarities",
      ).sort();
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
    });

    it("should have the same tables whether fresh install or full upgrade path", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshTables = getTableNames(freshDb).sort();
      freshDb.close();

      // Upgrade from pre-audio (oldest upgrade path)
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeTables = getTableNames(upgradeDb).sort();
      upgradeDb.close();

      expect(freshTables).toEqual(upgradeTables);
    });

    it("should have divination_card_availability table in both fresh and upgrade paths", () => {
      // Fresh install
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshTables = getTableNames(freshDb);
      freshDb.close();

      // Upgrade from pre-audio
      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeTables = getTableNames(upgradeDb);
      upgradeDb.close();

      expect(freshTables).toContain("divination_card_availability");
      expect(upgradeTables).toContain("divination_card_availability");
      // Prohibited library tables should be gone after all migrations
      expect(freshTables).not.toContain("prohibited_library_card_weights");
      expect(upgradeTables).not.toContain("prohibited_library_card_weights");
    });

    it("should produce the same divination_card_availability columns whether fresh or upgrade", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(
        freshDb,
        "divination_card_availability",
      );
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(
        upgradeDb,
        "divination_card_availability",
      );
      upgradeDb.close();

      expect(freshColumns).toEqual(upgradeColumns);
      expect(freshColumns).toEqual(EXPECTED_AVAILABILITY_COLUMNS);
    });

    it("should have last_seen_app_version on user_settings in both fresh and upgrade paths", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "user_settings");
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "user_settings");
      upgradeDb.close();

      expect(freshColumns).toContain("last_seen_app_version");
      expect(upgradeColumns).toContain("last_seen_app_version");
    });

    it("should NOT have from_boss on divination_cards in both fresh and upgrade paths (dropped by availability migration)", () => {
      const freshDb = new Database(":memory:");
      freshDb.pragma("foreign_keys = ON");
      createBaselineSchema(freshDb);
      const freshRunner = new MigrationRunner(freshDb);
      freshRunner.runMigrations(migrations);
      const freshColumns = getColumnNames(freshDb, "divination_cards");
      freshDb.close();

      const upgradeDb = new Database(":memory:");
      upgradeDb.pragma("foreign_keys = ON");
      createPreAudioSchema(upgradeDb);
      const upgradeRunner = new MigrationRunner(upgradeDb);
      upgradeRunner.runMigrations(migrations);
      const upgradeColumns = getColumnNames(upgradeDb, "divination_cards");
      upgradeDb.close();

      expect(freshColumns).not.toContain("from_boss");
      expect(upgradeColumns).not.toContain("from_boss");
    });
  });
});
