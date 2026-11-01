import Sqlite from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migration_20261031_120000_scope_community_upload_identities as migration } from "../../migrations/20261031_120000_scope_community_upload_identities";
import { migration_20261031_130000_reconcile_community_contributions as reconcile } from "../../migrations/20261031_130000_reconcile_community_contributions";

describe("community upload identity migration", () => {
  let db: Sqlite.Database;
  beforeEach(() => {
    db = new Sqlite(":memory:");
    db.exec(`
      CREATE TABLE app_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT INTO app_metadata VALUES ('device_id', 'installation-id');
      CREATE TABLE cards (game TEXT, scope TEXT, card_name TEXT, count INTEGER, PRIMARY KEY (game, scope, card_name));
      CREATE TABLE community_upload_snapshot (game TEXT, scope TEXT, card_name TEXT, count INTEGER, PRIMARY KEY (game, scope, card_name));
      CREATE TABLE community_upload_outbox (game TEXT, scope TEXT, cards_json TEXT, attempts INTEGER NOT NULL DEFAULT 0, last_error TEXT,
        next_attempt_at TEXT, created_at TEXT NOT NULL DEFAULT 'created', updated_at TEXT NOT NULL DEFAULT 'updated', PRIMARY KEY (game, scope));
      CREATE TABLE session_card_events (id INTEGER PRIMARY KEY, event_id TEXT);
      CREATE TABLE community_drop_event_outbox (event_id TEXT PRIMARY KEY, game TEXT, scope TEXT, created_at TEXT);
    `);
  });
  afterEach(() => db.close());

  it("supports a fresh installation and repeated application", () => {
    migration.up(db);
    migration.up(db);
    expect(
      db.prepare("SELECT * FROM community_upload_identities").all(),
    ).toEqual([{ id: "installation-id", account_id: null, kind: "legacy" }]);
    expect(
      db.prepare("SELECT * FROM community_upload_card_counts").all(),
    ).toEqual([]);
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
  });

  it("upgrades the staged ledger without resetting counters and removes aggregate-cache triggers", () => {
    db.exec("INSERT INTO cards VALUES ('poe1', 'Settlers', 'Doctor', 5)");
    migration.up(db);
    reconcile.up(db);
    reconcile.up(db);
    db.exec(
      "DELETE FROM cards; INSERT INTO cards VALUES ('poe1', 'Settlers', 'Doctor', 3)",
    );
    expect(
      db.prepare("SELECT count FROM community_upload_card_counts").all(),
    ).toEqual([{ count: 5 }]);
    expect(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'community_counts_on_%'",
        )
        .all(),
    ).toEqual([]);
    expect(
      db.prepare("SELECT parent_id FROM community_upload_identities").all(),
    ).toEqual([{ parent_id: null }]);
    expect(db.pragma("foreign_key_check")).toEqual([]);
  });

  it("preserves retry metadata and takes the greatest known cumulative total without adding it twice", () => {
    db.exec(`
      INSERT INTO cards VALUES ('poe1', 'Settlers', 'Doctor', 2);
      INSERT INTO cards VALUES ('poe1', 'all-time', 'Doctor', 90);
      INSERT INTO community_upload_snapshot VALUES ('poe1', 'Settlers', 'Doctor', 5);
      INSERT INTO community_upload_outbox VALUES ('poe1', 'Settlers', '[{"card_name":"Doctor","count":7}]',
        3, 'offline', '2099-01-01', 'created', 'updated');
      INSERT INTO session_card_events VALUES (1, 'opening-id');
      INSERT INTO community_drop_event_outbox VALUES ('opening-id', 'poe1', 'Settlers', 'created');
    `);
    migration.up(db);
    migration.up(db);
    expect(
      db.prepare("SELECT * FROM community_upload_card_counts").all(),
    ).toEqual([
      {
        identity_id: "installation-id",
        game: "poe1",
        scope: "Settlers",
        card_name: "Doctor",
        count: 7,
      },
    ]);
    expect(
      db.prepare("SELECT * FROM community_upload_outbox").get(),
    ).toMatchObject({
      identity_id: "installation-id",
      attempts: 3,
      last_error: "offline",
      next_attempt_at: "2099-01-01",
      created_at: "created",
      updated_at: "updated",
      cards_json: '[{"card_name":"Doctor","count":7}]',
    });
    expect(
      db.prepare("SELECT identity_id FROM session_card_events").get(),
    ).toEqual({ identity_id: "installation-id" });
    expect(
      db.prepare("SELECT identity_id FROM community_drop_event_outbox").get(),
    ).toEqual({ identity_id: "installation-id" });
  });

  it.each(["invalid-json", '["bad",null,1,{"count":-1}]'])(
    "retains corrupt queued payloads for safe retry handling: %s",
    (payload) => {
      db.prepare(
        "INSERT INTO community_upload_outbox (game, scope, cards_json) VALUES ('poe1', 'Settlers', ?)",
      ).run(payload);
      expect(() => migration.up(db)).not.toThrow();
      expect(
        db.prepare("SELECT cards_json FROM community_upload_outbox").get(),
      ).toEqual({ cards_json: payload });
      expect(
        db.prepare("SELECT * FROM community_upload_card_counts").all(),
      ).toEqual([]);
    },
  );

  it("preserves the original owner when an older event is enriched after an identity switch", () => {
    migration.up(db);
    db.exec(`INSERT INTO session_card_events (id, event_id) VALUES (1, 'old-event');
      UPDATE app_metadata SET value = 'new-anonymous-id' WHERE key = 'community_active_upload_identity';
      INSERT INTO community_drop_event_outbox (event_id, game, scope) VALUES ('old-event', 'poe1', 'Settlers');`);
    expect(
      db.prepare("SELECT identity_id FROM community_drop_event_outbox").get(),
    ).toEqual({ identity_id: "installation-id" });
  });

  it("refuses rollback so ownership and deduplication cannot be lost", () => {
    migration.up(db);
    db.exec(
      "INSERT INTO community_upload_identities (id, kind) VALUES ('anonymous-id', 'anonymous')",
    );
    expect(() => migration.down(db)).toThrow("Restore a database backup");
    expect(
      db
        .prepare("SELECT count(*) AS count FROM community_upload_identities")
        .get(),
    ).toEqual({ count: 2 });
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
  });
});
