import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

const OUTBOX_TABLE = "community_drop_event_outbox";
const NEXT_OUTBOX_TABLE = "community_drop_event_outbox_time_context";

function locationIsRequired(db: Database.Database): boolean {
  const column = db
    .prepare(`PRAGMA table_info(${OUTBOX_TABLE})`)
    .all()
    .find((value) => (value as { name?: unknown }).name === "location") as
    | { notnull: number }
    | undefined;
  return column?.notnull === 1;
}

function createOutboxTable(
  db: Database.Database,
  tableName: string,
  requireLocation: boolean,
): void {
  const locationDefinition = requireLocation
    ? "TEXT NOT NULL CHECK (length(location) BETWEEN 1 AND 200)"
    : "TEXT CHECK (location IS NULL OR length(location) BETWEEN 1 AND 200)";

  db.exec(`
    CREATE TABLE ${tableName} (
      event_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
      scope TEXT NOT NULL,
      card_name TEXT NOT NULL,
      location ${locationDefinition},
      local_minute INTEGER NOT NULL CHECK (local_minute BETWEEN 0 AND 1439),
      utc_offset_minutes INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -840 AND 840),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

function rebuildOutbox(db: Database.Database, requireLocation: boolean): void {
  db.exec(`DROP TABLE IF EXISTS ${NEXT_OUTBOX_TABLE}`);
  createOutboxTable(db, NEXT_OUTBOX_TABLE, requireLocation);
  db.exec(`
    INSERT INTO ${NEXT_OUTBOX_TABLE} (
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
      event_id,
      session_id,
      game,
      scope,
      card_name,
      location,
      local_minute,
      utc_offset_minutes,
      created_at
    FROM ${OUTBOX_TABLE}
    ${requireLocation ? "WHERE location IS NOT NULL" : ""}
  `);
  db.exec(`
    DROP TABLE ${OUTBOX_TABLE};
    ALTER TABLE ${NEXT_OUTBOX_TABLE} RENAME TO ${OUTBOX_TABLE};
    CREATE INDEX IF NOT EXISTS idx_community_drop_event_outbox_pending
      ON ${OUTBOX_TABLE}(game, scope, created_at);
  `);
}

export const migration_20261027_120000_allow_time_only_drop_context: Migration =
  {
    id: "20261027_120000_allow_time_only_drop_context",
    description:
      "Upload card-drop time context when the opening location is unknown",

    up(db: Database.Database): void {
      if (locationIsRequired(db)) rebuildOutbox(db, false);

      db.exec(`
        DROP INDEX IF EXISTS idx_session_card_events_context_backfill;
        CREATE INDEX IF NOT EXISTS idx_session_card_events_context_backfill
          ON session_card_events(card_name, dropped_at, id)
          WHERE source_event_id IS NULL AND event_id IS NOT NULL;
      `);

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
          AND sce.utc_offset_minutes IS NOT NULL
          AND sce.utc_offset_minutes BETWEEN -840 AND 840
          AND sce.location IS NULL;
      `);

      console.log(
        "[Migration] ✓ Applied: 20261027_120000_allow_time_only_drop_context",
      );
    },

    down(db: Database.Database): void {
      if (!locationIsRequired(db)) rebuildOutbox(db, true);
      db.exec(`
        DROP INDEX IF EXISTS idx_session_card_events_context_backfill;
        CREATE INDEX IF NOT EXISTS idx_session_card_events_context_backfill
          ON session_card_events(card_name, dropped_at, id)
          WHERE location IS NULL AND event_id IS NOT NULL;
      `);
      console.log(
        "[Migration] ✓ Rolled back: 20261027_120000_allow_time_only_drop_context",
      );
    },
  };
