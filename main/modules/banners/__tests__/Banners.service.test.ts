import { sql } from "kysely";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDatabaseServiceMock,
  createElectronMock,
} from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

// ─── Hoisted mock functions ─────────────────────────────────────────────────
const { mockGetKysely } = vi.hoisted(() => ({
  mockGetKysely: vi.fn(),
}));

// ─── Mock Electron before any imports that use it ────────────────────────────
vi.mock("electron", () => createElectronMock());

// ─── Mock DatabaseService singleton ──────────────────────────────────────────
vi.mock("~/main/modules/database", () =>
  createDatabaseServiceMock({ mockGetKysely }),
);

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

import { BannersService } from "../Banners.service";

describe("BannersService", () => {
  let testDb: TestDatabase;
  let service: BannersService;

  beforeEach(async () => {
    testDb = createTestDatabase();
    mockGetKysely.mockReturnValue(testDb.kysely);

    // Create the dismissed_banners table (not in baseline test schema)
    await sql`
      CREATE TABLE IF NOT EXISTS dismissed_banners (
        banner_id TEXT NOT NULL PRIMARY KEY,
        dismissed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `.execute(testDb.kysely);

    resetSingleton(BannersService);
    service = BannersService.getInstance();
  });

  afterEach(async () => {
    resetSingleton(BannersService);
    await testDb.close();
    vi.clearAllMocks();
  });

  // ─── Singleton ──────────────────────────────────────────────────────────────

  describe("singleton", () => {
    it("getInstance returns the same instance", () => {
      const a = BannersService.getInstance();
      const b = BannersService.getInstance();
      expect(a).toBe(b);
    });

    it("resetSingleton allows a fresh instance", () => {
      const before = BannersService.getInstance();
      resetSingleton(BannersService);
      const after = BannersService.getInstance();
      expect(after).not.toBe(before);
    });
  });

  // ─── isDismissed ────────────────────────────────────────────────────────────

  describe("isDismissed", () => {
    it("returns false for an unknown banner", async () => {
      const result = await service.isDismissed("unknown-banner");
      expect(result).toBe(false);
    });

    it("returns true after the banner has been dismissed", async () => {
      await service.dismiss("my-banner");
      const result = await service.isDismissed("my-banner");
      expect(result).toBe(true);
    });
  });

  // ─── dismiss ────────────────────────────────────────────────────────────────

  describe("dismiss", () => {
    it("is idempotent – dismissing the same banner twice does not throw", async () => {
      await service.dismiss("banner-1");
      await expect(service.dismiss("banner-1")).resolves.toBeUndefined();

      const dismissed = await service.isDismissed("banner-1");
      expect(dismissed).toBe(true);
    });
  });

  // ─── getAllDismissed ────────────────────────────────────────────────────────

  describe("getAllDismissed", () => {
    it("returns an empty array initially", async () => {
      const result = await service.getAllDismissed();
      expect(result).toEqual([]);
    });

    it("returns dismissed banners after dismiss calls", async () => {
      await service.dismiss("banner-a");
      await service.dismiss("banner-b");
      await service.dismiss("banner-c");

      const result = await service.getAllDismissed();
      expect(result).toEqual(
        expect.arrayContaining(["banner-a", "banner-b", "banner-c"]),
      );
      expect(result).toHaveLength(3);
    });
  });
});
