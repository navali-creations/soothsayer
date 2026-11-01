import type { Migration } from "./Migration.interface";

export const migration_20261031_130000_reconcile_community_contributions: Migration =
  {
    id: "20261031_130000_reconcile_community_contributions",
    description:
      "Record real openings and isolate future contributions after league deletion",
    up(db): void {
      db.exec(`DROP TRIGGER IF EXISTS community_counts_on_insert;
      DROP TRIGGER IF EXISTS community_counts_on_increase;
      DROP TRIGGER IF EXISTS community_owner_on_opening;
      DROP TRIGGER IF EXISTS community_owner_on_event;
      DROP TRIGGER IF EXISTS community_identity_on_installation;`);
      const columns = db
        .prepare("PRAGMA table_info(community_upload_identities)")
        .all() as { name: string }[];
      if (!columns.some((column) => column.name === "parent_id")) {
        db.exec(`ALTER TABLE community_upload_identities RENAME TO community_upload_identities_previous;
        CREATE TABLE community_upload_identities (
          id TEXT PRIMARY KEY, account_id TEXT,
          kind TEXT NOT NULL CHECK (kind IN ('anonymous', 'verified', 'legacy')),
          parent_id TEXT REFERENCES community_upload_identities(id),
          CHECK ((kind = 'verified') = (account_id IS NOT NULL))
        );
        INSERT INTO community_upload_identities (id, account_id, kind)
          SELECT id, account_id, kind FROM community_upload_identities_previous;
        DROP TABLE community_upload_identities_previous;`);
      }
      db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_community_root_account
        ON community_upload_identities(account_id) WHERE parent_id IS NULL;
      CREATE TABLE IF NOT EXISTS community_upload_scope_owners (
        identity_id TEXT NOT NULL REFERENCES community_upload_identities(id),
        game TEXT NOT NULL CHECK (game IN ('poe1', 'poe2')),
        scope TEXT NOT NULL,
        owner_id TEXT NOT NULL REFERENCES community_upload_identities(id),
        PRIMARY KEY (identity_id, game, scope)
      );
      CREATE TABLE IF NOT EXISTS community_upload_retired_scopes (
        identity_id TEXT NOT NULL REFERENCES community_upload_identities(id),
        game TEXT NOT NULL, scope TEXT NOT NULL,
        PRIMARY KEY (identity_id, game, scope)
      );
      CREATE TRIGGER IF NOT EXISTS community_skip_retired_outbox BEFORE INSERT ON community_upload_outbox
      WHEN EXISTS (SELECT 1 FROM community_upload_retired_scopes
        WHERE identity_id = NEW.identity_id AND game = NEW.game AND scope = NEW.scope)
      BEGIN SELECT RAISE(IGNORE); END;
      CREATE TRIGGER IF NOT EXISTS community_skip_retired_snapshot BEFORE INSERT ON community_upload_snapshot
      WHEN EXISTS (SELECT 1 FROM community_upload_retired_scopes
        WHERE identity_id = NEW.identity_id AND game = NEW.game AND scope = NEW.scope)
      BEGIN SELECT RAISE(IGNORE); END;
      CREATE TRIGGER IF NOT EXISTS community_identity_on_installation
      AFTER INSERT ON app_metadata WHEN NEW.key = 'device_id'
      BEGIN
        INSERT OR IGNORE INTO community_upload_identities (id, kind) VALUES (NEW.value, 'legacy');
        INSERT OR IGNORE INTO app_metadata (key, value) VALUES ('community_active_upload_identity', NEW.value);
      END;
      CREATE TRIGGER IF NOT EXISTS community_owner_on_opening AFTER INSERT ON session_card_events
      WHEN NEW.identity_id = '' AND EXISTS (SELECT 1 FROM app_metadata WHERE key = 'community_active_upload_identity')
      BEGIN
        UPDATE session_card_events SET identity_id = COALESCE(
          (SELECT owner.owner_id FROM community_upload_scope_owners owner
            JOIN sessions session ON session.id = NEW.session_id
            JOIN leagues league ON league.id = session.league_id
            WHERE owner.identity_id = (SELECT value FROM app_metadata WHERE key = 'community_active_upload_identity')
              AND owner.game = session.game AND owner.scope = league.name),
          (SELECT value FROM app_metadata WHERE key = 'community_active_upload_identity')
        ) WHERE id = NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS community_owner_on_event AFTER INSERT ON community_drop_event_outbox
      WHEN NEW.identity_id = '' AND EXISTS (SELECT 1 FROM app_metadata WHERE key = 'community_active_upload_identity')
      BEGIN
        UPDATE community_drop_event_outbox SET identity_id = COALESCE(
          (SELECT NULLIF(identity_id, '') FROM session_card_events WHERE event_id = NEW.event_id),
          (SELECT owner_id FROM community_upload_scope_owners
            WHERE identity_id = (SELECT value FROM app_metadata WHERE key = 'community_active_upload_identity')
              AND game = NEW.game AND scope = NEW.scope),
          (SELECT value FROM app_metadata WHERE key = 'community_active_upload_identity')
        ) WHERE event_id = NEW.event_id;
      END;
    `);
    },
    down(): void {
      throw new Error(
        "Contribution ownership requires restoring a database backup to downgrade.",
      );
    },
  };
