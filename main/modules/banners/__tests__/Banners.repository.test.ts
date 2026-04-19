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

  describe("isDismissed", () => {
    it("returns false when no banners are dismissed", async () => {
      const result = await repository.isDismissed("some-banner");
      expect(result).toBe(false);
    });

    it("returns true after a banner is dismissed", async () => {
      await repository.dismiss("my-banner");
      const result = await repository.isDismissed("my-banner");
      expect(result).toBe(true);
    });

    it("returns false for a different banner id", async () => {
      await repository.dismiss("banner-a");
      const result = await repository.isDismissed("banner-b");
      expect(result).toBe(false);
    });
  });

  describe("dismiss", () => {
    it("dismisses a banner successfully", async () => {
      await repository.dismiss("new-banner");
      const result = await repository.isDismissed("new-banner");
      expect(result).toBe(true);
    });

    it("is idempotent (calling dismiss twice doesn't throw)", async () => {
      await repository.dismiss("idempotent-banner");
      await expect(
        repository.dismiss("idempotent-banner"),
      ).resolves.not.toThrow();

      const result = await repository.isDismissed("idempotent-banner");
      expect(result).toBe(true);
    });

    it("can dismiss multiple different banners", async () => {
      await repository.dismiss("banner-1");
      await repository.dismiss("banner-2");
      await repository.dismiss("banner-3");

      expect(await repository.isDismissed("banner-1")).toBe(true);
      expect(await repository.isDismissed("banner-2")).toBe(true);
      expect(await repository.isDismissed("banner-3")).toBe(true);
    });
  });

  describe("getAllDismissed", () => {
    it("returns empty array when none dismissed", async () => {
      const result = await repository.getAllDismissed();
      expect(result).toEqual([]);
    });

    it("returns all dismissed banner ids", async () => {
      await repository.dismiss("banner-a");
      await repository.dismiss("banner-b");
      await repository.dismiss("banner-c");

      const result = await repository.getAllDismissed();
      expect(result).toHaveLength(3);
      expect(result).toContain("banner-a");
      expect(result).toContain("banner-b");
      expect(result).toContain("banner-c");
    });

    it("returns ids in insertion order", async () => {
      await repository.dismiss("first");
      await repository.dismiss("second");
      await repository.dismiss("third");

      const result = await repository.getAllDismissed();
      expect(result).toEqual(["first", "second", "third"]);
    });
  });
});
