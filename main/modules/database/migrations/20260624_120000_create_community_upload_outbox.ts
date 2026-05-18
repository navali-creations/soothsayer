import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

export const migration_20260624_120000_create_community_upload_outbox: Migration =
  {
    id: "20260624_120000_create_community_upload_outbox",
    description: "Create retryable community upload outbox",

    up(db: Database.Database): void {
      db.exec(`
        CREATE TABLE IF NOT EXISTS community_upload_outbox (
          game TEXT NOT NULL,
          scope TEXT NOT NULL,
          cards_json TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT,
          next_attempt_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (game, scope)
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_community_upload_outbox_next_attempt
        ON community_upload_outbox(next_attempt_at)
      `);

      console.log(
        "[Migration] ✓ Applied: 20260624_120000_create_community_upload_outbox",
      );
    },

    down(db: Database.Database): void {
      db.exec(`DROP INDEX IF EXISTS idx_community_upload_outbox_next_attempt`);
      db.exec(`DROP TABLE IF EXISTS community_upload_outbox`);
      console.log(
        "[Migration] ✓ Rolled back: 20260624_120000_create_community_upload_outbox",
      );
    },
  };
