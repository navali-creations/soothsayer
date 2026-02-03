import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: Add installed_games column to user_settings
 *
 * Purpose:
 * - Allow users to select one or both games (PoE1 and/or PoE2) during setup
 * - Stored as JSON array: '["poe1"]', '["poe2"]', or '["poe1", "poe2"]'
 * - The existing selected_game column remains for tracking the "active" game at runtime
 * - installed_games tracks which games the user has configured during setup
 *
 * Default:
 * - Defaults to '["poe1"]' for backwards compatibility with existing users
 * - For new users, this will be set during the setup flow
 */
export const migration_20240322_000001_add_installed_games: Migration = {
  id: "20240322_000001_add_installed_games",
  description:
    "Add installed_games column to user_settings for multi-game selection",

  up(db: Database.Database): void {
    // Check if column already exists
    const columnExists = db
      .prepare(
        `SELECT COUNT(*) as count FROM pragma_table_info('user_settings') WHERE name = 'installed_games'`,
      )
      .get() as { count: number };

    if (columnExists.count > 0) {
      console.log(
        "[Migration] ⚠ installed_games column already exists, skipping",
      );
      return;
    }

    // Add installed_games column with default value for backwards compatibility
    // Default to an array containing just the currently selected game
    db.exec(`
      ALTER TABLE user_settings
      ADD COLUMN installed_games TEXT NOT NULL DEFAULT '["poe1"]'
    `);

    // Update existing users: set installed_games based on their current selected_game
    db.exec(`
      UPDATE user_settings
      SET installed_games = '["' || selected_game || '"]'
      WHERE id = 1
    `);

    console.log("[Migration] ✓ Added installed_games column to user_settings");
  },

  down(db: Database.Database): void {
    // SQLite doesn't support DROP COLUMN directly in older versions
    // We need to recreate the table without the column
    db.exec(`
      CREATE TABLE user_settings_backup AS SELECT
        id,
        app_exit_action,
        app_open_at_login,
        app_open_at_login_minimized,
        onboarding_dismissed_beacons,
        overlay_bounds,
        poe1_client_txt_path,
        poe1_selected_league,
        poe1_price_source,
        poe2_client_txt_path,
        poe2_selected_league,
        poe2_price_source,
        selected_game,
        setup_completed,
        setup_step,
        setup_version,
        created_at,
        updated_at
      FROM user_settings
    `);

    db.exec(`DROP TABLE user_settings`);

    db.exec(`
      CREATE TABLE user_settings (
        id INTEGER PRIMARY KEY CHECK(id = 1),
        app_exit_action TEXT NOT NULL DEFAULT 'exit' CHECK(app_exit_action IN ('exit', 'minimize')),
        app_open_at_login INTEGER NOT NULL DEFAULT 0,
        app_open_at_login_minimized INTEGER NOT NULL DEFAULT 0,
        onboarding_dismissed_beacons TEXT NOT NULL DEFAULT '[]',
        overlay_bounds TEXT,
        poe1_client_txt_path TEXT,
        poe1_selected_league TEXT NOT NULL DEFAULT 'Standard',
        poe1_price_source TEXT NOT NULL DEFAULT 'exchange' CHECK(poe1_price_source IN ('exchange', 'stash')),
        poe2_client_txt_path TEXT,
        poe2_selected_league TEXT NOT NULL DEFAULT 'Standard',
        poe2_price_source TEXT NOT NULL DEFAULT 'stash' CHECK(poe2_price_source IN ('exchange', 'stash')),
        selected_game TEXT NOT NULL DEFAULT 'poe1' CHECK(selected_game IN ('poe1', 'poe2')),
        setup_completed INTEGER NOT NULL DEFAULT 0,
        setup_step INTEGER NOT NULL DEFAULT 0 CHECK(setup_step >= 0 AND setup_step <= 3),
        setup_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      INSERT INTO user_settings SELECT * FROM user_settings_backup
    `);

    db.exec(`DROP TABLE user_settings_backup`);

    console.log(
      "[Migration] ✓ Removed installed_games column from user_settings",
    );
  },
};
