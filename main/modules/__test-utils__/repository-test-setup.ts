import { afterEach, beforeEach } from "vitest";

import {
  createTestDatabase,
  type TestDatabase,
} from "~/main/modules/__test-utils__/create-test-db";

/**
 * Repository Test Setup Helper
 *
 * Encapsulates the common `beforeEach` / `afterEach` boilerplate shared by
 * every `*.repository.test.ts` file in the main-process modules.
 *
 * The pattern it replaces:
 * ```ts
 * let testDb: TestDatabase;
 * let repository: FooRepository;
 *
 * beforeEach(() => {
 *   testDb = createTestDatabase();
 *   repository = new FooRepository(testDb.kysely);
 * });
 *
 * afterEach(async () => {
 *   await testDb.close();
 * });
 * ```
 *
 * Usage:
 * ```ts
 * import { setupRepositoryTest } from "~/main/modules/__test-utils__/repository-test-setup";
 * import { AnalyticsRepository } from "../Analytics.repository";
 *
 * describe("AnalyticsRepository", () => {
 *   const { getRepository, getTestDb } = setupRepositoryTest(AnalyticsRepository);
 *
 *   it("should return empty array when no cards exist", async () => {
 *     const repository = getRepository();
 *     const results = await repository.getMostCommonCards("poe1", "Settlers", 10);
 *     expect(results).toEqual([]);
 *   });
 *
 *   it("can seed data via the test db", async () => {
 *     const testDb = getTestDb();
 *     await seedLeague(testDb.kysely, { game: "poe1" });
 *     // ...
 *   });
 * });
 * ```
 *
 * **Important**: Call `setupRepositoryTest` at the top level of a `describe`
 * block (not inside `beforeEach`). It registers its own `beforeEach` and
 * `afterEach` hooks internally.
 *
 * @param RepositoryClass - A class whose constructor accepts a single Kysely
 *   instance as its first argument.
 * @returns Accessor functions for the repository and underlying test database.
 *   These return the *current* values — always call them inside `it()` blocks
 *   (after `beforeEach` has run).
 */
export function setupRepositoryTest<T>(
  RepositoryClass: new (kysely: any) => T,
): {
  /** Returns the repository instance created for the current test. */
  getRepository: () => T;
  /** Returns the in-memory TestDatabase created for the current test. */
  getTestDb: () => TestDatabase;
} {
  let testDb: TestDatabase;
  let repository: T;

  beforeEach(() => {
    testDb = createTestDatabase();
    repository = new RepositoryClass(testDb.kysely);
  });

  afterEach(async () => {
    await testDb.close();
  });

  return {
    getRepository: () => repository,
    getTestDb: () => testDb,
  };
}
