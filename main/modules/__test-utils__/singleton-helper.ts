/**
 * Singleton Reset Helper
 *
 * Provides a typed utility to reset singleton service instances during testing.
 * This avoids needing `@ts-expect-error` comments on every `beforeEach`/`afterEach`
 * block that resets `_instance` on a singleton class.
 *
 * @example
 * ```ts
 * import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";
 * import { AnalyticsService } from "../Analytics.service";
 *
 * afterEach(() => {
 *   resetSingleton(AnalyticsService);
 * });
 * ```
 */

/**
 * Resets a singleton service instance for testing.
 *
 * Most main-process services follow the pattern:
 * ```ts
 * class FooService {
 *   private static _instance: FooService | undefined;
 *   static getInstance(): FooService { ... }
 * }
 * ```
 *
 * In tests we need to set `_instance = undefined` between tests so each test
 * gets a fresh singleton. Accessing `_instance` directly triggers a TypeScript
 * error because it's `private`. This helper casts through `any` in one place
 * so individual test files don't need `@ts-expect-error` annotations.
 *
 * @param ServiceClass - The service class whose singleton should be reset.
 */
export function resetSingleton(ServiceClass: unknown): void {
  (ServiceClass as Record<string, unknown>)._instance = undefined;
}

/**
 * Resets multiple singleton service instances at once.
 *
 * @param serviceClasses - The service classes whose singletons should be reset.
 *
 * @example
 * ```ts
 * import { resetSingletons } from "~/main/modules/__test-utils__/singleton-helper";
 *
 * afterEach(() => {
 *   resetSingletons(AnalyticsService, DataStoreService, SnapshotService);
 * });
 * ```
 */
export function resetSingletons(...serviceClasses: unknown[]): void {
  for (const ServiceClass of serviceClasses) {
    (ServiceClass as Record<string, unknown>)._instance = undefined;
  }
}
