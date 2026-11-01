import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

const activeIdentity =
  "(SELECT value FROM app_metadata WHERE key = 'community_active_upload_identity')";

function hasIdentity(db: Database.Database, table: string): boolean {
  return (
    db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  ).some(({ name }) => name === "identity_id");
}

export const migration_20261031_120000_scope_community_upload_identities: Migration =
  {
    id: "20261031_120000_scope_community_upload_identities",
    description:
      "Keep cumulative contributions and opening events owned by their original upload identity",
    up(db): void {
      const seedCounts = !db
        .prepare(
          "SELECT 1 FROM app_metadata WHERE key = 'community_identity_ledger_seeded'",
        )
        .get();
      db.exec(`
      CREATE TABLE IF NOT EXISTS community_upload_identities (
        id TEXT PRIMARY KEY,
        account_id TEXT UNIQUE,
        kind TEXT NOT NULL CHECK (kind IN ('anonymous', 'verified', 'legacy')),
        CHECK ((kind = 'verified') = (account_id IS NOT NULL))
      );
      INSERT OR IGNORE INTO community_upload_identities (id, kind)
        SELECT value, 'legacy' FROM app_metadata WHERE key = 'device_id';
      INSERT OR IGNORE INTO app_metadata (key, value)
        SELECT 'community_active_upload_identity', value FROM app_metadata WHERE key = 'device_id';
      CREATE TABLE IF NOT EXISTS community_upload_card_counts (
        identity_id TEXT NOT NULL,
        game TEXT NOT NULL,
        scope TEXT NOT NULL,
        card_name TEXT NOT NULL,
        count INTEGER NOT NULL CHECK (count > 0),
        PRIMARY KEY (identity_id, game, scope, card_name)
      );
    `);
      if (!hasIdentity(db, "community_upload_snapshot")) {
        db.exec(`
        ALTER TABLE community_upload_snapshot RENAME TO community_upload_snapshot_legacy;
        CREATE TABLE community_upload_snapshot (
          identity_id TEXT NOT NULL DEFAULT '', game TEXT NOT NULL,
          scope TEXT NOT NULL, card_name TEXT NOT NULL, count INTEGER NOT NULL,
          PRIMARY KEY (identity_id, game, scope, card_name)
        );
        INSERT INTO community_upload_snapshot
          SELECT COALESCE(${activeIdentity}, ''), game, scope, card_name, count
          FROM community_upload_snapshot_legacy;
        DROP TABLE community_upload_snapshot_legacy;
      `);
      }
      if (!hasIdentity(db, "community_upload_outbox")) {
        db.exec(`
        ALTER TABLE community_upload_outbox RENAME TO community_upload_outbox_legacy;
        DROP INDEX IF EXISTS idx_community_upload_outbox_next_attempt;
        CREATE TABLE community_upload_outbox (
          identity_id TEXT NOT NULL DEFAULT '', game TEXT NOT NULL, scope TEXT NOT NULL,
          cards_json TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT, next_attempt_at TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (identity_id, game, scope)
        );
        INSERT INTO community_upload_outbox
          SELECT COALESCE(${activeIdentity}, ''), game, scope, cards_json, attempts,
            last_error, next_attempt_at, created_at, updated_at
          FROM community_upload_outbox_legacy;
        DROP TABLE community_upload_outbox_legacy;
      `);
      }
      for (const table of [
        "session_card_events",
        "community_drop_event_outbox",
      ]) {
        if (!hasIdentity(db, table)) {
          db.exec(`ALTER TABLE ${table} ADD COLUMN identity_id TEXT NOT NULL DEFAULT '';
          UPDATE ${table} SET identity_id = COALESCE(${activeIdentity}, '');`);
        }
      }
      // Seed once from the greatest known cumulative total. An old queue or
      // acknowledged snapshot can exceed local history after sessions are deleted.
      if (seedCounts)
        db.exec(`
      INSERT INTO community_upload_card_counts
        SELECT identity_id, game, scope, card_name, MAX(count) FROM (
          SELECT (SELECT value FROM app_metadata WHERE key = 'device_id') AS identity_id, game, scope, card_name, count
            FROM cards WHERE scope != 'all-time' AND count > 0
          UNION ALL
          SELECT identity_id, game, scope, card_name, count FROM community_upload_snapshot
          UNION ALL
          SELECT o.identity_id, o.game, o.scope,
            json_extract(j.value, '$.card_name'), json_extract(j.value, '$.count')
          FROM community_upload_outbox o, json_each(CASE WHEN json_valid(o.cards_json) THEN o.cards_json ELSE '[]' END) raw
          JOIN json_each(CASE WHEN raw.type = 'object' THEN json_array(json(raw.value)) ELSE '[]' END) j
          WHERE json_type(j.value, '$.card_name') = 'text'
            AND json_type(j.value, '$.count') = 'integer'
            AND json_extract(j.value, '$.count') BETWEEN 1 AND 10000000
        ) WHERE identity_id IS NOT NULL AND identity_id != '' AND count > 0
        GROUP BY identity_id, game, scope, card_name
        ON CONFLICT DO NOTHING;
      INSERT INTO app_metadata (key, value) VALUES ('community_identity_ledger_seeded', 'true');
    `);
      db.exec(`
      CREATE INDEX IF NOT EXISTS idx_community_upload_outbox_next_attempt
        ON community_upload_outbox(next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_community_counts_scope
        ON community_upload_card_counts(game, scope, identity_id);
      CREATE INDEX IF NOT EXISTS idx_community_drop_events_identity
        ON community_drop_event_outbox(identity_id, game, scope, created_at);

      CREATE TRIGGER IF NOT EXISTS community_identity_on_installation
      AFTER INSERT ON app_metadata WHEN NEW.key = 'device_id'
      BEGIN
        INSERT OR IGNORE INTO community_upload_identities (id, kind) VALUES (NEW.value, 'legacy');
        INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('community_active_upload_identity', NEW.value);
        INSERT OR IGNORE INTO community_upload_card_counts
          SELECT NEW.value, game, scope, card_name, count FROM cards WHERE scope != 'all-time' AND count > 0;
      END;

      CREATE TRIGGER IF NOT EXISTS community_counts_on_insert AFTER INSERT ON cards
      WHEN NEW.scope != 'all-time' AND NEW.count > 0 AND ${activeIdentity} IS NOT NULL
      BEGIN
        INSERT INTO community_upload_card_counts VALUES (${activeIdentity}, NEW.game, NEW.scope, NEW.card_name, NEW.count)
        ON CONFLICT (identity_id, game, scope, card_name) DO UPDATE SET count = count + NEW.count;
      END;
      CREATE TRIGGER IF NOT EXISTS community_counts_on_increase AFTER UPDATE OF count ON cards
      WHEN NEW.scope != 'all-time' AND NEW.count > OLD.count AND ${activeIdentity} IS NOT NULL
      BEGIN
        INSERT INTO community_upload_card_counts VALUES (${activeIdentity}, NEW.game, NEW.scope, NEW.card_name, NEW.count - OLD.count)
        ON CONFLICT (identity_id, game, scope, card_name) DO UPDATE SET count = count + NEW.count - OLD.count;
      END;
      CREATE TRIGGER IF NOT EXISTS community_owner_on_opening AFTER INSERT ON session_card_events
      WHEN NEW.identity_id = '' AND ${activeIdentity} IS NOT NULL
      BEGIN
        UPDATE session_card_events SET identity_id = ${activeIdentity} WHERE id = NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS community_owner_on_event AFTER INSERT ON community_drop_event_outbox
      WHEN NEW.identity_id = '' AND ${activeIdentity} IS NOT NULL
      BEGIN
        UPDATE community_drop_event_outbox SET identity_id = COALESCE(
          (SELECT NULLIF(identity_id, '') FROM session_card_events WHERE event_id = NEW.event_id), ${activeIdentity}
        ) WHERE event_id = NEW.event_id;
      END;
    `);
    },
    down(): void {
      throw new Error(
        "Upload identity ownership cannot be safely combined. Restore a database backup to downgrade.",
      );
    },
  };
