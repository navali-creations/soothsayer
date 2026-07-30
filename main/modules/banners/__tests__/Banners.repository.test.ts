import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { BannersRepository } from "../Banners.repository";

describe("BannersRepository", () => {
  let testDb: TestDatabase;
  let repository: BannersRepository;

  beforeEach(async () => {
    testDb = createTestDatabase();
    // Create the dismissed_banners table (not in baseline schema)
    await sql`
      CREATE TABLE IF NOT EXISTS dismissed_banners (
        banner_id TEXT NOT NULL PRIMARY KEY,
        dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `.execute(testDb.kysely);
    repository = new BannersRepository(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  describe("dismiss", () => {
    it("dismisses a banner successfully", async () => {
      await repository.dismiss("community-backfill");
      const result = await repository.getDismissed(["community-backfill"]);
      expect(result).toEqual(["community-backfill"]);
    });

    it("is idempotent (calling dismiss twice doesn't throw)", async () => {
      await repository.dismiss("community-backfill");
      await expect(
        repository.dismiss("community-backfill"),
      ).resolves.not.toThrow();

      const result = await repository.getDismissed(["community-backfill"]);
      expect(result).toEqual(["community-backfill"]);
    });
  });

  describe("getDismissed", () => {
    it("returns empty array when none dismissed", async () => {
      const result = await repository.getDismissed(["community-backfill"]);
      expect(result).toEqual([]);
    });

    it("filters the query to the supplied allowlist", async () => {
      await repository.dismiss("community-backfill");
      await testDb.kysely
        .insertInto("dismissed_banners")
        .values({ banner_id: "unknown-banner" })
        .execute();

      const result = await repository.getDismissed(["community-backfill"]);
      expect(result).toEqual(["community-backfill"]);
    });

    it("short-circuits an empty allowlist", async () => {
      await expect(repository.getDismissed([])).resolves.toEqual([]);
    });
  });
});
