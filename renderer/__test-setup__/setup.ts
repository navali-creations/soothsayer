/**
 * Global vitest setup for all renderer-process tests.
 *
 * Runs before every test file when using `vitest.renderer.config.mts`.
 *
 * Responsibilities:
 * 1. Register `@testing-library/jest-dom` matchers (toBeInTheDocument, etc.)
 * 2. Install a fresh `window.electron` mock (IPC bridge) per test
 * 3. Mock `@sentry/electron/renderer` to prevent real Sentry init in tests
 * 4. Mock the Umami analytics module to prevent real event tracking
 * 5. Mock `import.meta.env` values that renderer code reads at module level
 */

import "@testing-library/jest-dom/vitest";

import { afterEach, beforeEach, vi } from "vitest";

import { installElectronMock, removeElectronMock } from "./electron-mock";

// ─── Mock: @sentry/electron/renderer ───────────────────────────────────────
//
// `@sentry/electron/renderer` tries to import Electron internals at the module
// level, which fails in jsdom. Mock it globally with no-ops.
//
vi.mock("@sentry/electron/renderer", () => ({
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

// ─── Mock: renderer/sentry.ts ──────────────────────────────────────────────
//
// Even with the SDK mocked above, mock the renderer's own sentry wrapper
// to guarantee `initSentry()` is always a no-op in tests.
//
vi.mock("~/renderer/sentry", () => ({
  initSentry: vi.fn(),
}));

// ─── Mock: Umami analytics ─────────────────────────────────────────────────
//
// Prevent any real analytics calls; allow tests to assert on tracked events.
//
vi.mock("~/renderer/modules/umami", () => ({
  initUmami: vi.fn(),
  trackEvent: vi.fn(),
  trackPageView: vi.fn(),
}));

// ─── Mock: electron module (bare import) ───────────────────────────────────
//
// Some API files import directly from "electron". In jsdom this doesn't exist.
//
vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn(),
    send: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
}));

// ─── Per-test lifecycle ────────────────────────────────────────────────────

beforeEach(() => {
  // Install a fresh window.electron mock for every test so each test
  // starts with clean mocks and no cross-test bleed.
  installElectronMock();
});

afterEach(() => {
  removeElectronMock();
  vi.restoreAllMocks();
});

// ─── jsdom missing APIs ────────────────────────────────────────────────────
//
// jsdom doesn't implement some browser APIs that renderer code may reference.
// Stub them here to avoid "not defined" errors.
//

// window.matchMedia (used by DaisyUI theme detection, motion, etc.)
if (typeof window.matchMedia === "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// HTMLElement.prototype.showPopover / hidePopover (Popover API, used by usePopover)
if (typeof HTMLElement.prototype.showPopover === "undefined") {
  HTMLElement.prototype.showPopover = vi.fn();
}
if (typeof HTMLElement.prototype.hidePopover === "undefined") {
  HTMLElement.prototype.hidePopover = vi.fn();
}

// window.ResizeObserver (used by some component libraries)
if (typeof window.ResizeObserver === "undefined") {
  (window as any).ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// window.IntersectionObserver (used by lazy-loading components)
if (typeof window.IntersectionObserver === "undefined") {
  (window as any).IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
}

// HTMLCanvasElement.getContext (used by useChartColors for color parsing)
if (typeof HTMLCanvasElement.prototype.getContext === "undefined") {
  (HTMLCanvasElement.prototype as any).getContext = vi
    .fn()
    .mockReturnValue(null);
}
