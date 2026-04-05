import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: create session_card_events table
 *
 * Creates the `session_card_events` table for per-drop event logging with
 * timestamps and price snapshots. Each row represents a single card drop
 * within a session, capturing the chaos/divine value at the time of the drop.
 *
 * This table powers the Session Profit Timeline feature, enabling time-series
 * charts of profit accumulation during a session.
 *
 * Indexes:
 * - `idx_session_card_events_session`: for chronological queries (ASC)
 *   SQLite can efficiently reverse-scan this index for DESC queries too.
 */
export const migration_20260331_225900_create_session_card_events: Migration = {
  id: "20260331_225900_create_session_card_events",
  description:
    "create session_card_events table for per-drop event logging with timestamps and price snapshots",

  up(db: Database.Database): void {
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_card_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        card_name TEXT NOT NULL,
        chaos_value REAL,
        divine_value REAL,
        dropped_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_card_events_session
        ON session_card_events(session_id, dropped_at ASC)
    `);

    console.log(
      "[Migration] ✓ Applied: 20260331_225900_create_session_card_events",
    );
  },

  down(db: Database.Database): void {
    db.exec(`DROP INDEX IF EXISTS idx_session_card_events_session`);
    db.exec(`DROP TABLE IF EXISTS session_card_events`);

    console.log(
      "[Migration] ✓ Rolled back: 20260331_225900_create_session_card_events",
    );
  },
};
