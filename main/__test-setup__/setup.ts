/**
 * Global vitest setup for all main-process tests.
 *
 * `@sentry/electron/main` tries to import native Electron APIs at the module level,
 * which fails in the vitest/Node environment with:
 *
 *   SyntaxError: Named export 'app' not found. The requested module 'electron'
 *   is a CommonJS module, which may not support all module.exports as named exports.
 *
 * This import is triggered transitively through:
 *   SettingsStoreService → ClientLogReaderService → barrel ~/main/modules → SentryService → @sentry/electron/main
 *
 * Rather than adding `vi.mock("@sentry/electron/main", ...)` to every test file that
 * might transitively reach this chain, we mock it globally here.
 */
import { vi } from "vitest";

vi.mock("@sentry/electron/main", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setExtra: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn((cb: (scope: any) => void) =>
    cb({
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setLevel: vi.fn(),
    }),
  ),
}));
