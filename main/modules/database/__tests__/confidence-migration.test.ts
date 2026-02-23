import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { MigrationRunner } from "../migrations";
import { migration_20260215_120000_add_confidence_and_unknown_rarity } from "../migrations/20260215_120000_add_confidence_and_unknown_rarity";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getColumnNames(db: Database.Database, table: string): string[] {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return columns.map((c) => c.name);
}

function getColumnInfo(
  db: Database.Database,
  table: string,
): Array<{ name: string; type: string }> {
  return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
    name: string;
    type: string;
  }>;
}

function getTableNames(db: Database.Database): string[] {
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return tables.map((t) => t.name);
}

/**
 * Creates a minimal schema that contains `snapshot_card_prices` with a TEXT
 * confidence column (simulating the old schema before the migration), plus
 * the `divination_card_rarities` table with the old CHECK constraint
 * (rarity 1–4 only, no override_rarity).
 *
 * Also includes the `snapshots` and `leagues` tables so FK constraints work.
 */
function createSchemaWithTextConfidence(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
    )
  `);

  // Old schema: confidence is TEXT, and stack_size + created_at are present
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot_card_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      confidence TEXT NOT NULL DEFAULT 'high',
      stack_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      UNIQUE(snapshot_id, card_name, price_source)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshot_prices_snapshot
    ON snapshot_card_prices(snapshot_id)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_snapshot_prices_card
    ON snapshot_card_prices(card_name, price_source)
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS divination_card_rarities (
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      card_name TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (game, league, card_name)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
    ON divination_card_rarities(game, league)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
    ON divination_card_rarities(card_name)
  `);
}

/**
 * Creates a schema where `snapshot_card_prices` already has an INTEGER
 * confidence column (simulating a partially migrated or current schema),
 * and still has `stack_size` and `created_at`.
 */
function createSchemaWithIntegerConfidence(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
    )
  `);

  // confidence is already INTEGER, but stack_size/created_at still present
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot_card_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
      stack_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      UNIQUE(snapshot_id, card_name, price_source)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS divination_card_rarities (
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      card_name TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (game, league, card_name)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
    ON divination_card_rarities(game, league)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
    ON divination_card_rarities(card_name)
  `);
}

/**
 * Creates a schema WITHOUT the `divination_card_rarities` table.
 * This simulates a database where the table was never created.
 */
function createSchemaWithoutCardRarities(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot_card_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      stack_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      UNIQUE(snapshot_id, card_name, price_source)
    )
  `);
}

/**
 * Creates a schema where `divination_card_rarities` already has the
 * `override_rarity` column (simulating a database that already had
 * the migration partially applied).
 */
function createSchemaWithOverrideRarityAlreadyPresent(
  db: Database.Database,
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS leagues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      game TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(game, name)
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      league_id TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      exchange_chaos_to_divine REAL NOT NULL,
      stash_chaos_to_divine REAL NOT NULL,
      stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshot_card_prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id TEXT NOT NULL,
      card_name TEXT NOT NULL,
      price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
      chaos_value REAL NOT NULL,
      divine_value REAL NOT NULL,
      stack_size INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
      UNIQUE(snapshot_id, card_name, price_source)
    )
  `);

  // Already has override_rarity and rarity >= 0
  db.exec(`
    CREATE TABLE IF NOT EXISTS divination_card_rarities (
      game TEXT NOT NULL,
      league TEXT NOT NULL,
      card_name TEXT NOT NULL,
      rarity INTEGER NOT NULL CHECK(rarity >= 0 AND rarity <= 4),
      override_rarity INTEGER CHECK(override_rarity IS NULL OR (override_rarity >= 0 AND override_rarity <= 4)),
      last_updated TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (game, league, card_name)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
    ON divination_card_rarities(game, league)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
    ON divination_card_rarities(card_name)
  `);
}

/**
 * Inserts seed data into snapshot_card_prices for the TEXT confidence schema.
 * Returns the snapshot_id used so callers can query results.
 */
function seedTextConfidenceData(db: Database.Database): string {
  const leagueId = "league-1";
  const snapshotId = "snap-1";

  db.prepare("INSERT INTO leagues (id, name, game) VALUES (?, ?, ?)").run(
    leagueId,
    "Standard",
    "poe1",
  );

  db.prepare(
    "INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine) VALUES (?, ?, datetime('now'), 200.0, 195.0)",
  ).run(snapshotId, leagueId);

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "The Doctor", "exchange", 1200.5, 6.0, "high");

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "House of Mirrors", "exchange", 5000.0, 25.0, "medium");

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "Rain of Chaos", "stash", 0.5, 0.0025, "low");

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "Unknown Card", "stash", 1.0, 0.005, "unknown_value");

  return snapshotId;
}

/**
 * Inserts seed data into snapshot_card_prices for the INTEGER confidence schema.
 */
function seedIntegerConfidenceData(db: Database.Database): string {
  const leagueId = "league-1";
  const snapshotId = "snap-1";

  db.prepare("INSERT INTO leagues (id, name, game) VALUES (?, ?, ?)").run(
    leagueId,
    "Standard",
    "poe1",
  );

  db.prepare(
    "INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine) VALUES (?, ?, datetime('now'), 200.0, 195.0)",
  ).run(snapshotId, leagueId);

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "The Doctor", "exchange", 1200.5, 6.0, 1);

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "House of Mirrors", "exchange", 5000.0, 25.0, 2);

  db.prepare(
    "INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(snapshotId, "Rain of Chaos", "stash", 0.5, 0.0025, 3);

  return snapshotId;
}

// ─── Migration reference ─────────────────────────────────────────────────────

const migration = migration_20260215_120000_add_confidence_and_unknown_rarity;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("confidence and unknown rarity migration (20260215_120000)", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    db.close();
  });

  // ─── TEXT → INTEGER confidence conversion ──────────────────────────────

  describe("TEXT → INTEGER confidence conversion", () => {
    it("should convert TEXT confidence column to INTEGER", () => {
      createSchemaWithTextConfidence(db);

      // Verify column starts as TEXT
      const before = getColumnInfo(db, "snapshot_card_prices");
      const confBefore = before.find((c) => c.name === "confidence");
      expect(confBefore).toBeDefined();
      expect(confBefore!.type).toBe("TEXT");

      migration.up(db);

      // Verify column is now INTEGER
      const after = getColumnInfo(db, "snapshot_card_prices");
      const confAfter = after.find((c) => c.name === "confidence");
      expect(confAfter).toBeDefined();
      expect(confAfter!.type).toBe("INTEGER");
    });

    it("should map 'high' → 1, 'medium' → 2, 'low' → 3 during conversion", () => {
      createSchemaWithTextConfidence(db);
      seedTextConfidenceData(db);

      migration.up(db);

      const rows = db
        .prepare(
          "SELECT card_name, confidence FROM snapshot_card_prices ORDER BY card_name",
        )
        .all() as Array<{ card_name: string; confidence: number }>;

      const byName = new Map(rows.map((r) => [r.card_name, r.confidence]));

      expect(byName.get("The Doctor")).toBe(1); // 'high' → 1
      expect(byName.get("House of Mirrors")).toBe(2); // 'medium' → 2
      expect(byName.get("Rain of Chaos")).toBe(3); // 'low' → 3
      expect(byName.get("Unknown Card")).toBe(1); // unknown defaults to 1
    });

    it("should preserve non-confidence data during TEXT → INTEGER conversion", () => {
      createSchemaWithTextConfidence(db);
      seedTextConfidenceData(db);

      migration.up(db);

      const doctor = db
        .prepare(
          "SELECT card_name, price_source, chaos_value, divine_value FROM snapshot_card_prices WHERE card_name = 'The Doctor'",
        )
        .get() as {
        card_name: string;
        price_source: string;
        chaos_value: number;
        divine_value: number;
      };

      expect(doctor.card_name).toBe("The Doctor");
      expect(doctor.price_source).toBe("exchange");
      expect(doctor.chaos_value).toBe(1200.5);
      expect(doctor.divine_value).toBe(6.0);
    });

    it("should preserve row count during TEXT → INTEGER conversion", () => {
      createSchemaWithTextConfidence(db);
      seedTextConfidenceData(db);

      const countBefore = (
        db
          .prepare("SELECT COUNT(*) as count FROM snapshot_card_prices")
          .get() as { count: number }
      ).count;

      migration.up(db);

      const countAfter = (
        db
          .prepare("SELECT COUNT(*) as count FROM snapshot_card_prices")
          .get() as { count: number }
      ).count;

      expect(countAfter).toBe(countBefore);
    });

    it("should remove stack_size and created_at columns after TEXT → INTEGER rebuild", () => {
      createSchemaWithTextConfidence(db);

      // Verify columns exist before
      const before = getColumnNames(db, "snapshot_card_prices");
      expect(before).toContain("stack_size");
      expect(before).toContain("created_at");

      migration.up(db);

      // The TEXT→INTEGER rebuild creates a new table without stack_size/created_at,
      // and the subsequent ALTER TABLE DROP COLUMN checks handle any remaining ones.
      const after = getColumnNames(db, "snapshot_card_prices");
      expect(after).not.toContain("stack_size");
      expect(after).not.toContain("created_at");
    });

    it("should recreate indexes after TEXT → INTEGER conversion", () => {
      createSchemaWithTextConfidence(db);
      seedTextConfidenceData(db);

      migration.up(db);

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='snapshot_card_prices' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain("idx_snapshot_prices_snapshot");
      expect(indexNames).toContain("idx_snapshot_prices_card");
    });
  });

  // ─── Already-INTEGER confidence (no-op for confidence column) ──────────

  describe("already-INTEGER confidence column", () => {
    it("should not throw when confidence is already INTEGER", () => {
      createSchemaWithIntegerConfidence(db);

      expect(() => migration.up(db)).not.toThrow();
    });

    it("should preserve existing INTEGER confidence data without modification", () => {
      createSchemaWithIntegerConfidence(db);
      seedIntegerConfidenceData(db);

      migration.up(db);

      const rows = db
        .prepare(
          "SELECT card_name, confidence FROM snapshot_card_prices ORDER BY card_name",
        )
        .all() as Array<{ card_name: string; confidence: number }>;

      const byName = new Map(rows.map((r) => [r.card_name, r.confidence]));
      expect(byName.get("The Doctor")).toBe(1);
      expect(byName.get("House of Mirrors")).toBe(2);
      expect(byName.get("Rain of Chaos")).toBe(3);
    });

    it("should still drop stack_size and created_at columns when confidence is already INTEGER", () => {
      createSchemaWithIntegerConfidence(db);

      const before = getColumnNames(db, "snapshot_card_prices");
      expect(before).toContain("stack_size");
      expect(before).toContain("created_at");

      migration.up(db);

      const after = getColumnNames(db, "snapshot_card_prices");
      expect(after).not.toContain("stack_size");
      expect(after).not.toContain("created_at");
    });

    it("should keep confidence column as INTEGER type", () => {
      createSchemaWithIntegerConfidence(db);

      migration.up(db);

      const columns = getColumnInfo(db, "snapshot_card_prices");
      const conf = columns.find((c) => c.name === "confidence");
      expect(conf).toBeDefined();
      expect(conf!.type).toBe("INTEGER");
    });
  });

  // ─── No stack_size/created_at to drop ──────────────────────────────────

  describe("schema without stack_size and created_at", () => {
    it("should not throw when stack_size and created_at are already absent", () => {
      // Create a schema that has already had these columns removed
      db.exec(`
        CREATE TABLE IF NOT EXISTS leagues (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          game TEXT NOT NULL,
          UNIQUE(game, name)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id TEXT PRIMARY KEY,
          league_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          exchange_chaos_to_divine REAL NOT NULL,
          stash_chaos_to_divine REAL NOT NULL,
          stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
          FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshot_card_prices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
          chaos_value REAL NOT NULL,
          divine_value REAL NOT NULL,
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
          UNIQUE(snapshot_id, card_name, price_source)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS divination_card_rarities (
          game TEXT NOT NULL,
          league TEXT NOT NULL,
          card_name TEXT NOT NULL,
          rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
          last_updated TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, league, card_name)
        )
      `);

      // Should add confidence and modify divination_card_rarities without error
      expect(() => migration.up(db)).not.toThrow();

      const columns = getColumnNames(db, "snapshot_card_prices");
      expect(columns).toContain("confidence");
      expect(columns).not.toContain("stack_size");
      expect(columns).not.toContain("created_at");
    });
  });

  // ─── Missing divination_card_rarities table ────────────────────────────

  describe("missing divination_card_rarities table", () => {
    it("should not throw when divination_card_rarities table does not exist", () => {
      createSchemaWithoutCardRarities(db);

      expect(() => migration.up(db)).not.toThrow();
    });

    it("should still add confidence column to snapshot_card_prices", () => {
      createSchemaWithoutCardRarities(db);

      migration.up(db);

      const columns = getColumnNames(db, "snapshot_card_prices");
      expect(columns).toContain("confidence");
    });

    it("should not create divination_card_rarities table", () => {
      createSchemaWithoutCardRarities(db);

      migration.up(db);

      const tables = getTableNames(db);
      expect(tables).not.toContain("divination_card_rarities");
    });
  });

  // ─── override_rarity already present (idempotency) ────────────────────

  describe("override_rarity already present", () => {
    it("should not throw when override_rarity column already exists", () => {
      createSchemaWithOverrideRarityAlreadyPresent(db);

      expect(() => migration.up(db)).not.toThrow();
    });

    it("should preserve existing data in divination_card_rarities", () => {
      createSchemaWithOverrideRarityAlreadyPresent(db);

      // Insert data with rarity 0 and override_rarity
      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity, override_rarity) VALUES (?, ?, ?, ?, ?)",
      ).run("poe1", "Standard", "The Doctor", 0, 1);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "Rain of Chaos", 4);

      migration.up(db);

      const rows = db
        .prepare(
          "SELECT card_name, rarity, override_rarity FROM divination_card_rarities ORDER BY card_name",
        )
        .all() as Array<{
        card_name: string;
        rarity: number;
        override_rarity: number | null;
      }>;

      expect(rows).toHaveLength(2);

      const doctor = rows.find((r) => r.card_name === "The Doctor");
      expect(doctor?.rarity).toBe(0);
      expect(doctor?.override_rarity).toBe(1);

      const rain = rows.find((r) => r.card_name === "Rain of Chaos");
      expect(rain?.rarity).toBe(4);
      expect(rain?.override_rarity).toBeNull();
    });

    it("should not duplicate the override_rarity column", () => {
      createSchemaWithOverrideRarityAlreadyPresent(db);

      migration.up(db);

      const columns = getColumnNames(db, "divination_card_rarities");
      const overrideCount = columns.filter(
        (c) => c === "override_rarity",
      ).length;
      expect(overrideCount).toBe(1);
    });
  });

  // ─── Post-migration constraints ───────────────────────────────────────

  describe("post-migration constraints", () => {
    it("should allow rarity 0 in divination_card_rarities after migration", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES ('poe1', 'Standard', 'Unknown Card', 0)",
          )
          .run(),
      ).not.toThrow();
    });

    it("should still reject rarity < 0 in divination_card_rarities after migration", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES ('poe1', 'Standard', 'Bad Card', -1)",
          )
          .run(),
      ).toThrow();
    });

    it("should still reject rarity > 4 in divination_card_rarities after migration", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES ('poe1', 'Standard', 'Bad Card', 5)",
          )
          .run(),
      ).toThrow();
    });

    it("should enforce override_rarity CHECK constraint (valid range 0–4 or NULL)", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      // NULL is valid
      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity, override_rarity) VALUES ('poe1', 'Standard', 'Card A', 0, NULL)",
          )
          .run(),
      ).not.toThrow();

      // 0–4 are valid
      for (let i = 0; i <= 4; i++) {
        expect(() =>
          db
            .prepare(
              `INSERT INTO divination_card_rarities (game, league, card_name, rarity, override_rarity) VALUES ('poe1', 'Standard', 'Card Override ${i}', 0, ${i})`,
            )
            .run(),
        ).not.toThrow();
      }

      // -1 and 5 are invalid
      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity, override_rarity) VALUES ('poe1', 'Standard', 'Bad Override Low', 0, -1)",
          )
          .run(),
      ).toThrow();

      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity, override_rarity) VALUES ('poe1', 'Standard', 'Bad Override High', 0, 5)",
          )
          .run(),
      ).toThrow();
    });

    it("should enforce confidence CHECK constraint (1, 2, or 3)", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      const leagueId = "league-check";
      const snapshotId = "snap-check";

      db.prepare("INSERT INTO leagues (id, name, game) VALUES (?, ?, ?)").run(
        leagueId,
        "Standard",
        "poe1",
      );

      db.prepare(
        "INSERT INTO snapshots (id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine) VALUES (?, ?, datetime('now'), 200.0, 195.0)",
      ).run(snapshotId, leagueId);

      // Valid confidence values
      for (const conf of [1, 2, 3]) {
        expect(() =>
          db
            .prepare(
              `INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES ('${snapshotId}', 'Card Conf ${conf}', 'exchange', 100.0, 0.5, ${conf})`,
            )
            .run(),
        ).not.toThrow();
      }

      // Invalid confidence values
      expect(() =>
        db
          .prepare(
            `INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES ('${snapshotId}', 'Bad Conf 0', 'exchange', 100.0, 0.5, 0)`,
          )
          .run(),
      ).toThrow();

      expect(() =>
        db
          .prepare(
            `INSERT INTO snapshot_card_prices (snapshot_id, card_name, price_source, chaos_value, divine_value, confidence) VALUES ('${snapshotId}', 'Bad Conf 4', 'exchange', 100.0, 0.5, 4)`,
          )
          .run(),
      ).toThrow();
    });
  });

  // ─── down() rollback ──────────────────────────────────────────────────

  describe("down() rollback", () => {
    it("should restore stack_size and created_at columns on rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      // Verify they're gone after up()
      let columns = getColumnNames(db, "snapshot_card_prices");
      expect(columns).not.toContain("stack_size");
      expect(columns).not.toContain("created_at");

      migration.down(db);

      // Verify they're back after down()
      columns = getColumnNames(db, "snapshot_card_prices");
      expect(columns).toContain("stack_size");
      expect(columns).toContain("created_at");
    });

    it("should remove confidence column on rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      let columns = getColumnNames(db, "snapshot_card_prices");
      expect(columns).toContain("confidence");

      migration.down(db);

      // Confidence column is removed because the down() rebuilds the table
      // without it (the original schema didn't have it — it was added by
      // a previous migration step). Actually, looking at the down() code,
      // it does rebuild with a new table that doesn't have confidence...
      // Wait, let me re-check. The down() rebuilds to remove confidence
      // and restore stack_size/created_at. Let me verify.
      columns = getColumnNames(db, "snapshot_card_prices");
      // The down() method only runs the rebuild if confidence exists
      // and the result doesn't include confidence column.
      expect(columns).not.toContain("confidence");
    });

    it("should preserve price data during rollback", () => {
      createSchemaWithTextConfidence(db);
      seedTextConfidenceData(db);
      migration.up(db);

      // Verify data survived up()
      const countAfterUp = (
        db
          .prepare("SELECT COUNT(*) as count FROM snapshot_card_prices")
          .get() as { count: number }
      ).count;
      expect(countAfterUp).toBe(4);

      migration.down(db);

      // Verify data survived down()
      const countAfterDown = (
        db
          .prepare("SELECT COUNT(*) as count FROM snapshot_card_prices")
          .get() as { count: number }
      ).count;
      expect(countAfterDown).toBe(4);

      // Verify core data fields are preserved
      const doctor = db
        .prepare(
          "SELECT card_name, price_source, chaos_value, divine_value FROM snapshot_card_prices WHERE card_name = 'The Doctor'",
        )
        .get() as {
        card_name: string;
        price_source: string;
        chaos_value: number;
        divine_value: number;
      };

      expect(doctor.card_name).toBe("The Doctor");
      expect(doctor.price_source).toBe("exchange");
      expect(doctor.chaos_value).toBe(1200.5);
      expect(doctor.divine_value).toBe(6.0);
    });

    it("should remove override_rarity column on rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      let columns = getColumnNames(db, "divination_card_rarities");
      expect(columns).toContain("override_rarity");

      migration.down(db);

      columns = getColumnNames(db, "divination_card_rarities");
      expect(columns).not.toContain("override_rarity");
    });

    it("should restore CHECK constraint to rarity >= 1 on rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      // Rarity 0 should be allowed after up()
      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES ('poe1', 'Standard', 'Test Card', 0)",
      ).run();

      migration.down(db);

      // Rarity 0 should now be rejected (constraint restored to >= 1)
      expect(() =>
        db
          .prepare(
            "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES ('poe1', 'Standard', 'New Card', 0)",
          )
          .run(),
      ).toThrow();

      // Rarity 1–4 should still be valid
      for (let r = 1; r <= 4; r++) {
        expect(() =>
          db
            .prepare(
              `INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES ('poe1', 'Standard', 'Card R${r}', ${r})`,
            )
            .run(),
        ).not.toThrow();
      }
    });

    it("should clamp rarity 0 to 1 during downgrade", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      // Insert cards with various rarities including 0
      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "Unknown Card", 0);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "The Doctor", 1);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "House of Mirrors", 2);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "Rain of Chaos", 4);

      migration.down(db);

      const rows = db
        .prepare(
          "SELECT card_name, rarity FROM divination_card_rarities ORDER BY card_name",
        )
        .all() as Array<{ card_name: string; rarity: number }>;

      const byName = new Map(rows.map((r) => [r.card_name, r.rarity]));

      // Rarity 0 should be clamped to 1
      expect(byName.get("Unknown Card")).toBe(1);
      // Other rarities should be unchanged
      expect(byName.get("The Doctor")).toBe(1);
      expect(byName.get("House of Mirrors")).toBe(2);
      expect(byName.get("Rain of Chaos")).toBe(4);
    });

    it("should preserve divination_card_rarities data count during rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "Card A", 1);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "Card B", 3);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity, override_rarity) VALUES (?, ?, ?, ?, ?)",
      ).run("poe1", "Standard", "Card C", 0, 2);

      const countBefore = (
        db
          .prepare("SELECT COUNT(*) as count FROM divination_card_rarities")
          .get() as { count: number }
      ).count;
      expect(countBefore).toBe(3);

      migration.down(db);

      const countAfter = (
        db
          .prepare("SELECT COUNT(*) as count FROM divination_card_rarities")
          .get() as { count: number }
      ).count;
      expect(countAfter).toBe(3);
    });

    it("should recreate indexes on snapshot_card_prices after rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);
      migration.down(db);

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='snapshot_card_prices' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain("idx_snapshot_prices_snapshot");
      expect(indexNames).toContain("idx_snapshot_prices_card");
    });

    it("should recreate indexes on divination_card_rarities after rollback", () => {
      createSchemaWithTextConfidence(db);
      migration.up(db);
      migration.down(db);

      const indexes = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='divination_card_rarities' AND name NOT LIKE 'sqlite_%'",
        )
        .all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain("idx_card_rarities_game_league");
      expect(indexNames).toContain("idx_card_rarities_card_name");
    });

    it("should handle rollback when confidence column does not exist (no-op)", () => {
      // Create a schema without any confidence column
      db.exec(`
        CREATE TABLE IF NOT EXISTS leagues (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          game TEXT NOT NULL,
          UNIQUE(game, name)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id TEXT PRIMARY KEY,
          league_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          exchange_chaos_to_divine REAL NOT NULL,
          stash_chaos_to_divine REAL NOT NULL,
          stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
          FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshot_card_prices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
          chaos_value REAL NOT NULL,
          divine_value REAL NOT NULL,
          stack_size INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
          UNIQUE(snapshot_id, card_name, price_source)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS divination_card_rarities (
          game TEXT NOT NULL,
          league TEXT NOT NULL,
          card_name TEXT NOT NULL,
          rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
          last_updated TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, league, card_name)
        )
      `);

      // down() should not throw even if confidence doesn't exist
      expect(() => migration.down(db)).not.toThrow();
    });

    it("should handle rollback when override_rarity does not exist (no-op for card rarities)", () => {
      // Create a schema where divination_card_rarities doesn't have override_rarity
      db.exec(`
        CREATE TABLE IF NOT EXISTS leagues (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          game TEXT NOT NULL,
          UNIQUE(game, name)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
          id TEXT PRIMARY KEY,
          league_id TEXT NOT NULL,
          fetched_at TEXT NOT NULL,
          exchange_chaos_to_divine REAL NOT NULL,
          stash_chaos_to_divine REAL NOT NULL,
          stacked_deck_chaos_cost REAL NOT NULL DEFAULT 0,
          FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS snapshot_card_prices (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          snapshot_id TEXT NOT NULL,
          card_name TEXT NOT NULL,
          price_source TEXT NOT NULL CHECK(price_source IN ('exchange', 'stash')),
          chaos_value REAL NOT NULL,
          divine_value REAL NOT NULL,
          confidence INTEGER NOT NULL DEFAULT 1 CHECK(confidence IN (1, 2, 3)),
          FOREIGN KEY (snapshot_id) REFERENCES snapshots(id) ON DELETE CASCADE,
          UNIQUE(snapshot_id, card_name, price_source)
        )
      `);

      db.exec(`
        CREATE TABLE IF NOT EXISTS divination_card_rarities (
          game TEXT NOT NULL,
          league TEXT NOT NULL,
          card_name TEXT NOT NULL,
          rarity INTEGER NOT NULL CHECK(rarity >= 1 AND rarity <= 4),
          last_updated TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, league, card_name)
        )
      `);

      // down() should still handle the confidence rebuild but skip the
      // divination_card_rarities rebuild
      expect(() => migration.down(db)).not.toThrow();

      const columns = getColumnNames(db, "divination_card_rarities");
      expect(columns).not.toContain("override_rarity");
    });
  });

  // ─── Round-trip (up → down → up) ──────────────────────────────────────

  describe("round-trip (up → down → up)", () => {
    it("should allow applying, rolling back, and re-applying the migration", () => {
      createSchemaWithTextConfidence(db);

      expect(() => migration.up(db)).not.toThrow();
      expect(() => migration.down(db)).not.toThrow();
      expect(() => migration.up(db)).not.toThrow();

      // Verify final state is correct
      const scpColumns = getColumnNames(db, "snapshot_card_prices");
      expect(scpColumns).toContain("confidence");
      expect(scpColumns).not.toContain("stack_size");
      expect(scpColumns).not.toContain("created_at");

      const dcrColumns = getColumnNames(db, "divination_card_rarities");
      expect(dcrColumns).toContain("override_rarity");
    });

    it("should preserve data through a complete round-trip", () => {
      createSchemaWithTextConfidence(db);
      seedTextConfidenceData(db);

      // Insert rarity data
      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "The Doctor", 1);

      db.prepare(
        "INSERT INTO divination_card_rarities (game, league, card_name, rarity) VALUES (?, ?, ?, ?)",
      ).run("poe1", "Standard", "Rain of Chaos", 4);

      migration.up(db);
      migration.down(db);
      migration.up(db);

      // Verify price data survived
      const priceCount = (
        db
          .prepare("SELECT COUNT(*) as count FROM snapshot_card_prices")
          .get() as { count: number }
      ).count;
      expect(priceCount).toBe(4);

      // Verify rarity data survived
      const rarityCount = (
        db
          .prepare("SELECT COUNT(*) as count FROM divination_card_rarities")
          .get() as { count: number }
      ).count;
      expect(rarityCount).toBe(2);

      // Verify specific rarity values are intact
      const rows = db
        .prepare(
          "SELECT card_name, rarity FROM divination_card_rarities ORDER BY card_name",
        )
        .all() as Array<{ card_name: string; rarity: number }>;

      const byName = new Map(rows.map((r) => [r.card_name, r.rarity]));
      expect(byName.get("The Doctor")).toBe(1);
      expect(byName.get("Rain of Chaos")).toBe(4);
    });
  });

  // ─── Integration with MigrationRunner ─────────────────────────────────

  describe("integration with MigrationRunner", () => {
    it("should apply via MigrationRunner on a TEXT confidence schema", () => {
      createSchemaWithTextConfidence(db);
      const runner = new MigrationRunner(db);

      expect(() => runner.runMigrations([migration])).not.toThrow();

      const columns = getColumnNames(db, "snapshot_card_prices");
      expect(columns).toContain("confidence");
      expect(columns).not.toContain("stack_size");
      expect(columns).not.toContain("created_at");
    });

    it("should be recorded as applied by MigrationRunner", () => {
      createSchemaWithTextConfidence(db);
      const runner = new MigrationRunner(db);

      runner.runMigrations([migration]);

      const applied = runner.listAppliedMigrations();
      expect(applied.length).toBe(1);
      expect(applied[0]).toContain(migration.id);
    });

    it("should rollback and re-apply via MigrationRunner", () => {
      createSchemaWithTextConfidence(db);
      const runner = new MigrationRunner(db);

      runner.runMigrations([migration]);
      runner.rollbackMigration(migration);

      const afterRollback = runner.listAppliedMigrations();
      expect(afterRollback.length).toBe(0);

      runner.runMigrations([migration]);

      const afterReapply = runner.listAppliedMigrations();
      expect(afterReapply.length).toBe(1);
      expect(afterReapply[0]).toContain(migration.id);
    });

    it("should be idempotent via MigrationRunner (skip if already applied)", () => {
      createSchemaWithTextConfidence(db);
      const runner = new MigrationRunner(db);

      runner.runMigrations([migration]);
      // Running again should be a no-op
      expect(() => runner.runMigrations([migration])).not.toThrow();

      const applied = runner.listAppliedMigrations();
      expect(applied.length).toBe(1);
    });
  });
});
