import { Kysely, SqliteDialect, sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  seedLeague,
  seedSession,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";
import type { Database } from "~/main/modules/database/Database.types";

import { CommunityUploadRepository } from "../CommunityUpload.repository";

describe("CommunityUploadRepository", () => {
  let testDb: TestDatabase;
  let repository: CommunityUploadRepository;

  beforeEach(async () => {
    testDb = createTestDatabase();
    await sql`
      CREATE TABLE dismissed_banners (
        banner_id TEXT NOT NULL PRIMARY KEY,
        dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `.execute(testDb.kysely);
    repository = new CommunityUploadRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  it("uses indexed owner lookups for a 120,000-event history queue", async () => {
    testDb.db
      .prepare(
        "INSERT INTO app_metadata (key, value) VALUES ('device_id', 'history-owner')",
      )
      .run();
    const leagueId = await seedLeague(testDb.kysely, { name: "History" });
    const sessionId = await seedSession(testDb.kysely, { leagueId });
    testDb.db
      .prepare(`WITH RECURSIVE events(n) AS (
      SELECT 1 UNION ALL SELECT n+1 FROM events WHERE n < 120000
    ) INSERT INTO community_drop_event_outbox (
      event_id, session_id, game, scope, card_name, local_minute, utc_offset_minutes, identity_id
    ) SELECT printf('00000000-0000-4000-8000-%012x', n), ?, 'poe1', 'History', 'The Scholar', 1, 0, 'history-owner' FROM events`)
      .run(sessionId);
    const queries: Array<{ sql: string; parameters: readonly unknown[] }> = [];
    const observed = new Kysely<Database>({
      dialect: new SqliteDialect({
        database: {
          close() {},
          prepare: (statement) => testDb.db.prepare(statement),
        },
      }),
      log: (event) => {
        if (event.level === "query") queries.push(event.query);
      },
    });
    try {
      const measuredRepository = new CommunityUploadRepository(observed);
      await expect(
        measuredRepository.getUploadWarning(null, true),
      ).resolves.toBeUndefined();
      const details = queries.flatMap((query) => {
        const plan = testDb.db
          .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
          .all(...query.parameters) as Array<{ detail: string }>;
        return plan.map((row) => row.detail);
      });
      expect(
        details.some((detail) =>
          /SEARCH event .*idx_community_drop_events_identity/.test(detail),
        ),
      ).toBe(true);
      expect(details.some((detail) => /SCAN event/.test(detail))).toBe(false);
      testDb.db.exec(
        "INSERT INTO community_upload_identities (id, kind) VALUES ('current-owner', 'anonymous'); UPDATE app_metadata SET value='current-owner' WHERE key='community_active_upload_identity'",
      );
      await expect(
        measuredRepository.getUploadWarning(null, true),
      ).resolves.toBe("verification-required");
      await expect(
        measuredRepository.getUploadWarning(null, false),
      ).resolves.toBeUndefined();
    } finally {
      await observed.destroy();
    }
  });

  it("releases only the linked account's verification failures and preserves other retry delays", async () => {
    await testDb.kysely
      .insertInto("community_upload_identities")
      .values([
        { id: "owner-a", kind: "verified", account_id: "account-a" },
        { id: "owner-b", kind: "verified", account_id: "account-b" },
      ])
      .execute();
    const later = "2099-01-01T00:00:00.000Z";
    await testDb.kysely
      .insertInto("community_upload_outbox")
      .values([
        {
          identity_id: "owner-a",
          game: "poe1",
          scope: "proof",
          cards_json: "[]",
          next_attempt_at: later,
          last_error: "COMMUNITY_IDENTITY_PROOF_REQUIRED",
        },
        {
          identity_id: "owner-a",
          game: "poe1",
          scope: "network",
          cards_json: "[]",
          next_attempt_at: later,
          last_error: "offline",
        },
        {
          identity_id: "owner-b",
          game: "poe1",
          scope: "proof",
          cards_json: "[]",
          next_attempt_at: later,
          last_error: "COMMUNITY_IDENTITY_PROOF_REQUIRED",
        },
      ])
      .execute();
    await repository.releaseVerificationRetries("account-a");
    const rows = await testDb.kysely
      .selectFrom("community_upload_outbox")
      .select(["identity_id", "scope", "next_attempt_at"])
      .orderBy("identity_id")
      .orderBy("scope")
      .execute();
    expect(rows).toEqual([
      { identity_id: "owner-a", scope: "network", next_attempt_at: later },
      { identity_id: "owner-a", scope: "proof", next_attempt_at: null },
      { identity_id: "owner-b", scope: "proof", next_attempt_at: later },
    ]);
  });

  it("requires a separate choice even when community uploads were enabled", async () => {
    await testDb.kysely
      .updateTable("user_settings")
      .set({ community_uploads_enabled: 1 })
      .where("id", "=", 1)
      .execute();
    await expect(repository.getDropContextConsent()).resolves.toBeNull();
  });

  it("persists opt-in and withdrawal across repository instances", async () => {
    await repository.setDropContextConsent(true);
    const restarted = new CommunityUploadRepository(testDb.kysely);
    await expect(restarted.getDropContextConsent()).resolves.toBe(true);
    await restarted.setDropContextConsent(false);
    await expect(repository.getDropContextConsent()).resolves.toBe(false);
  });

  it.each(["1", "yes", "", "null"])(
    "does not treat invalid metadata %j as consent",
    async (value) => {
      await testDb.kysely
        .insertInto("app_metadata")
        .values({ key: "community_drop_context_consent_v1", value })
        .execute();
      await expect(repository.getDropContextConsent()).resolves.toBeNull();
    },
  );

  it("returns bounded, valid leagues that have not been completed", async () => {
    await testDb.kysely
      .insertInto("cards")
      .values([
        {
          game: "poe1",
          scope: "Settlers",
          card_name: "The Scholar",
          count: 1,
          last_updated: null,
        },
        {
          game: "poe2",
          scope: "Dawn",
          card_name: "The Scholar",
          count: 2,
          last_updated: null,
        },
        {
          game: "poe1",
          scope: "all-time",
          card_name: "The Scholar",
          count: 3,
          last_updated: null,
        },
        {
          game: "invalid",
          scope: "Unsafe",
          card_name: "The Scholar",
          count: 4,
          last_updated: null,
        },
        {
          game: "poe1",
          scope: "x".repeat(257),
          card_name: "The Scholar",
          count: 5,
          last_updated: null,
        },
      ])
      .execute();
    await testDb.kysely
      .insertInto("app_metadata")
      .values({
        key: "community_backfill_done_poe2_Dawn",
        value: "true",
      })
      .execute();

    await expect(repository.getBackfillLeagues()).resolves.toEqual([
      { game: "poe1", league: "Settlers" },
    ]);
  });

  it("returns no backfill leagues when there are no candidates", async () => {
    await expect(repository.getBackfillLeagues()).resolves.toEqual([]);
  });

  it("rejects an unexpectedly large candidate set", async () => {
    await testDb.kysely
      .insertInto("cards")
      .values(
        Array.from({ length: 201 }, (_, index) => ({
          game: "poe1",
          scope: `League ${index}`,
          card_name: "The Scholar",
          count: 1,
          last_updated: null,
        })),
      )
      .execute();

    await expect(repository.getBackfillLeagues()).rejects.toThrow(
      "Backfill league limit exceeded",
    );
  });

  it("commits completion markers and dismissal together", async () => {
    await repository.commitBackfill(
      [
        { game: "poe1", league: "Settlers" },
        { game: "poe2", league: "Dawn" },
      ],
      true,
    );

    const markers = await testDb.kysely
      .selectFrom("app_metadata")
      .select(["key", "value"])
      .where("key", "like", "community_backfill_done_%")
      .orderBy("key")
      .execute();
    const dismissal = await testDb.kysely
      .selectFrom("dismissed_banners")
      .select("banner_id")
      .executeTakeFirst();

    expect(markers).toEqual([
      {
        key: "community_backfill_done_poe1_Settlers",
        value: "true",
      },
      {
        key: "community_backfill_done_poe2_Dawn",
        value: "true",
      },
    ]);
    expect(dismissal?.banner_id).toBe("community-backfill");
  });

  it("records partial progress without dismissing the banner", async () => {
    await repository.commitBackfill(
      [{ game: "poe1", league: "Settlers" }],
      false,
    );

    const marker = await testDb.kysely
      .selectFrom("app_metadata")
      .select("key")
      .where("key", "=", "community_backfill_done_poe1_Settlers")
      .executeTakeFirst();
    const dismissal = await testDb.kysely
      .selectFrom("dismissed_banners")
      .select("banner_id")
      .executeTakeFirst();

    expect(marker?.key).toBe("community_backfill_done_poe1_Settlers");
    expect(dismissal).toBeUndefined();
  });

  it("allows an empty backfill commit", async () => {
    await expect(repository.commitBackfill([], false)).resolves.toBeUndefined();
  });

  it("rolls back completion markers when dismissal cannot be persisted", async () => {
    await sql`DROP TABLE dismissed_banners`.execute(testDb.kysely);

    await expect(
      repository.commitBackfill([{ game: "poe1", league: "Settlers" }], true),
    ).rejects.toThrow();

    const marker = await testDb.kysely
      .selectFrom("app_metadata")
      .select("key")
      .where("key", "=", "community_backfill_done_poe1_Settlers")
      .executeTakeFirst();
    expect(marker).toBeUndefined();
  });
});
