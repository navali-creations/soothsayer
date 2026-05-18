import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { migration_20260624_120000_create_community_upload_outbox } from "../../migrations/20260624_120000_create_community_upload_outbox";

describe("create_community_upload_outbox migration idempotency", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("should handle up() when table already exists", () => {
    migration_20260624_120000_create_community_upload_outbox.up(db);

    expect(() =>
      migration_20260624_120000_create_community_upload_outbox.up(db),
    ).not.toThrow();

    const columns = db
      .prepare("PRAGMA table_info(community_upload_outbox)")
      .all() as { name: string }[];

    expect(columns.map((c) => c.name)).toEqual([
      "game",
      "scope",
      "cards_json",
      "attempts",
      "last_error",
      "next_attempt_at",
      "created_at",
      "updated_at",
    ]);
  });

  it("should create the retry index", () => {
    migration_20260624_120000_create_community_upload_outbox.up(db);

    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='community_upload_outbox'",
      )
      .all() as { name: string }[];

    expect(indexes.map((i) => i.name)).toContain(
      "idx_community_upload_outbox_next_attempt",
    );
  });

  it("should handle down() when table does not exist", () => {
    expect(() =>
      migration_20260624_120000_create_community_upload_outbox.down(db),
    ).not.toThrow();
  });
});
