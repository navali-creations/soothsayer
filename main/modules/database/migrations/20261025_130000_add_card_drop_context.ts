import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

function hasColumn(
  db: Database.Database,
  table: string,
  column: string,
): boolean {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
    name: string;
  }[];
  return columns.some(({ name }) => name === column);
}

function addColumnIfMissing(
  db: Database.Database,
  column: string,
  definition: string,
): void {
  if (!hasColumn(db, "session_card_events", column)) {
    db.exec(`ALTER TABLE session_card_events ADD COLUMN ${definition}`);
  }
}

function migrateDraftOutboxSchema(db: Database.Database): boolean {
  if (
    !hasColumn(db, "community_drop_event_outbox", "event_id") ||
    hasColumn(db, "community_drop_event_outbox", "session_id")
  ) {
    return false;
  }

  const counts = db
    .prepare(`
      SELECT
        COUNT(*) AS total,
        COUNT(sce.id) AS matched
      FROM community_drop_event_outbox draft
      LEFT JOIN session_card_events sce ON sce.event_id = draft.event_id
    `)
    .get() as { total: number; matched: number };

  if (counts.total !== counts.matched) {
    throw new Error(
      `Cannot migrate draft card-drop outbox: ${counts.total - counts.matched} event(s) have no matching session`,
    );
  }

  db.exec(`
    ALTER TABLE community_drop_event_outbox
    RENAME TO community_drop_event_outbox_draft;
    DROP INDEX IF EXISTS idx_community_drop_event_outbox_pending;
  `);
  return true;
}

export const migration_20261025_130000_add_card_drop_context: Migration = {
  id: "20261025_130000_add_card_drop_context",
  description:
    "Store card-drop location and local-time context with a retryable upload outbox",

  up(db: Database.Database): void {
    addColumnIfMissing(db, "event_id", "event_id TEXT");
    addColumnIfMissing(db, "source_event_id", "source_event_id TEXT");
    addColumnIfMissing(db, "location", "location TEXT");
    addColumnIfMissing(
      db,
      "utc_offset_minutes",
      "utc_offset_minutes INTEGER CHECK (utc_offset_minutes BETWEEN -840 AND 840)",
    );

    db.exec(`
      UPDATE session_card_events
      SET event_id = lower(
        hex(randomblob(4)) || '-' ||
        hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' ||
        substr('89ab', (random() & 3) + 1, 1) ||
        substr(hex(randomblob(2)), 2) || '-' ||
        hex(randomblob(6))
      )
      WHERE event_id IS NULL
    `);

    db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_session_card_events_event_id
      ON session_card_events(event_id)
      WHERE event_id IS NOT NULL
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_card_events_context_backfill
      ON session_card_events(card_name, dropped_at, id)
      WHERE location IS NULL AND event_id IS NOT NULL
    `);

    const migratedDraftOutbox = migrateDraftOutboxSchema(db);

    db.exec(`
      CREATE TABLE IF NOT EXISTS community_drop_event_outbox (
        event_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
        game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        location TEXT NOT NULL CHECK (length(location) BETWEEN 1 AND 200),
        local_minute INTEGER NOT NULL CHECK (local_minute BETWEEN 0 AND 1439),
        utc_offset_minutes INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -840 AND 840),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_community_drop_event_outbox_pending
      ON community_drop_event_outbox(game, scope, created_at)
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS community_drop_event_upload_state (
        game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
        scope TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        next_attempt_at TEXT,
        PRIMARY KEY (game, scope)
      )
    `);

    if (migratedDraftOutbox) {
      db.exec(`
        INSERT INTO community_drop_event_outbox (
          event_id,
          session_id,
          game,
          scope,
          card_name,
          location,
          local_minute,
          utc_offset_minutes,
          created_at
        )
        SELECT
          draft.event_id,
          sce.session_id,
          draft.game,
          draft.scope,
          draft.card_name,
          draft.location,
          draft.local_minute,
          draft.utc_offset_minutes,
          draft.created_at
        FROM community_drop_event_outbox_draft draft
        JOIN session_card_events sce ON sce.event_id = draft.event_id;

        INSERT INTO community_drop_event_upload_state (
          game,
          scope,
          attempts,
          last_error,
          next_attempt_at
        )
        SELECT
          game,
          scope,
          MAX(attempts),
          MAX(last_error),
          MAX(next_attempt_at)
        FROM community_drop_event_outbox_draft
        GROUP BY game, scope
        ON CONFLICT (game, scope) DO UPDATE SET
          attempts = excluded.attempts,
          last_error = excluded.last_error,
          next_attempt_at = excluded.next_attempt_at;

        DROP TABLE community_drop_event_outbox_draft;
      `);
    }

    // Queue any context that may already have been written by a partially
    // applied development build. This is idempotent through the event PK.
    db.exec(`
      INSERT OR IGNORE INTO community_drop_event_outbox (
        event_id,
        session_id,
        game,
        scope,
        card_name,
        location,
        local_minute,
        utc_offset_minutes,
        created_at
      )
      SELECT
        sce.event_id,
        sce.session_id,
        s.game,
        l.name,
        sce.card_name,
        sce.location,
        (
          (
            CAST(strftime('%H', sce.dropped_at) AS INTEGER) * 60
            + CAST(strftime('%M', sce.dropped_at) AS INTEGER)
            + sce.utc_offset_minutes
          ) % 1440 + 1440
        ) % 1440,
        sce.utc_offset_minutes,
        sce.dropped_at
      FROM session_card_events sce
      JOIN sessions s ON s.id = sce.session_id
      JOIN leagues l ON l.id = s.league_id
      WHERE sce.event_id IS NOT NULL
        AND sce.location IS NOT NULL
        AND length(sce.location) BETWEEN 1 AND 200
        AND sce.utc_offset_minutes IS NOT NULL
        AND sce.utc_offset_minutes BETWEEN -840 AND 840
    `);

    console.log("[Migration] ✓ Applied: 20261025_130000_add_card_drop_context");
  },

  down(db: Database.Database): void {
    db.exec(`DROP TABLE IF EXISTS community_drop_event_upload_state`);
    db.exec(`DROP INDEX IF EXISTS idx_community_drop_event_outbox_pending`);
    db.exec(`DROP TABLE IF EXISTS community_drop_event_outbox`);
    db.exec(`DROP INDEX IF EXISTS idx_session_card_events_context_backfill`);
    db.exec(`DROP INDEX IF EXISTS idx_session_card_events_event_id`);

    for (const column of [
      "utc_offset_minutes",
      "location",
      "source_event_id",
      "event_id",
    ]) {
      if (hasColumn(db, "session_card_events", column)) {
        db.exec(`ALTER TABLE session_card_events DROP COLUMN ${column}`);
      }
    }

    console.log(
      "[Migration] ✓ Rolled back: 20261025_130000_add_card_drop_context",
    );
  },
};
