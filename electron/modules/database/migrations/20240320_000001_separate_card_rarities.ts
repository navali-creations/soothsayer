import type Database from "better-sqlite3";
import type { Migration } from "./Migration.interface";

/**
 * Migration: Separate card rarity data from static card data
 *
 * Problem:
 * - Rarity is league-specific (based on poe.ninja prices)
 * - Currently stored as a single field in divination_cards table
 * - Switching leagues overwrites rarity data, causing redundant API calls
 *
 * Solution:
 * - Create divination_card_rarities table to store league-specific rarity
 * - Remove rarity field from divination_cards table
 * - Enable caching of rarity per league for better performance
 */
export const migration_20240320_000001_separate_card_rarities: Migration = {
  id: "20240320_000001_separate_card_rarities",
  description: "Separate card rarity data into league-specific table",

  up(db: Database.Database): void {
    // Step 1: Create new divination_card_rarities table
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

    // Create indexes for efficient queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_card_rarities_game_league
      ON divination_card_rarities(game, league)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_card_rarities_card_name
      ON divination_card_rarities(card_name)
    `);

    // Step 2: Migrate existing rarity data to the new table
    // We'll copy the current rarity values to a "default" league entry
    // This preserves existing data during migration
    db.exec(`
      INSERT INTO divination_card_rarities (game, league, card_name, rarity)
      SELECT
        game,
        'migration_default' as league,
        name as card_name,
        rarity
      FROM divination_cards
      WHERE rarity IS NOT NULL
    `);

    // Step 3: Create a temporary table with the new schema (without rarity)
    db.exec(`
      CREATE TABLE divination_cards_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        stack_size INTEGER NOT NULL,
        description TEXT NOT NULL,
        reward_html TEXT NOT NULL,
        art_src TEXT NOT NULL,
        flavour_html TEXT,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        data_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, name)
      )
    `);

    // Step 4: Copy data from old table to new table (excluding rarity)
    db.exec(`
      INSERT INTO divination_cards_new
        (id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, created_at, updated_at)
      SELECT
        id, name, stack_size, description, reward_html, art_src, flavour_html, game, data_hash, created_at, updated_at
      FROM divination_cards
    `);

    // Step 5: Drop old table and rename new table
    db.exec(`DROP TABLE divination_cards`);
    db.exec(`ALTER TABLE divination_cards_new RENAME TO divination_cards`);

    // Step 6: Recreate indexes for divination_cards
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_game_name
      ON divination_cards(game, name)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_name
      ON divination_cards(name)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size
      ON divination_cards(stack_size)
    `);

    console.log(
      "[Migration] ✓ Separated rarity data into divination_card_rarities table",
    );
  },

  down(db: Database.Database): void {
    // Step 1: Create old table structure with rarity field
    db.exec(`
      CREATE TABLE divination_cards_old (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        stack_size INTEGER NOT NULL,
        description TEXT NOT NULL,
        reward_html TEXT NOT NULL,
        art_src TEXT NOT NULL,
        flavour_html TEXT,
        rarity INTEGER NOT NULL DEFAULT 4,
        game TEXT NOT NULL CHECK(game IN ('poe1', 'poe2')),
        data_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(game, name)
      )
    `);

    // Step 2: Copy data back, using migration_default league for rarity
    db.exec(`
      INSERT INTO divination_cards_old
        (id, name, stack_size, description, reward_html, art_src, flavour_html, rarity, game, data_hash, created_at, updated_at)
      SELECT
        dc.id,
        dc.name,
        dc.stack_size,
        dc.description,
        dc.reward_html,
        dc.art_src,
        dc.flavour_html,
        COALESCE(dcr.rarity, 4) as rarity,
        dc.game,
        dc.data_hash,
        dc.created_at,
        dc.updated_at
      FROM divination_cards dc
      LEFT JOIN divination_card_rarities dcr
        ON dcr.game = dc.game
        AND dcr.league = 'migration_default'
        AND dcr.card_name = dc.name
    `);

    // Step 3: Drop new table and rename old table
    db.exec(`DROP TABLE divination_cards`);
    db.exec(`ALTER TABLE divination_cards_old RENAME TO divination_cards`);

    // Step 4: Recreate indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_game_name
      ON divination_cards(game, name)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_name
      ON divination_cards(name)
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_divination_cards_stack_size
      ON divination_cards(stack_size)
    `);

    // Step 5: Drop the rarities table
    db.exec(`DROP TABLE divination_card_rarities`);

    console.log("[Migration] ✓ Rolled back rarity separation");
  },
};
