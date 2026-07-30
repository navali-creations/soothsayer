import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

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
