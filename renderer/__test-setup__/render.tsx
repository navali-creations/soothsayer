/**
 * Render helper for component tests.
 *
 * Wraps the component under test with all necessary providers so that
 * components can be rendered in isolation without wiring up the full app
 * shell.
 *
 * Usage:
 *
 *   import { renderWithProviders } from '~/renderer/__test-setup__/render';
 *
 *   it('renders a greeting', () => {
 *     const { getByText } = renderWithProviders(<MyComponent />);
 *     expect(getByText('Hello')).toBeInTheDocument();
 *   });
 *
 * With store overrides:
 *
 *   const { getByText } = renderWithProviders(<MyComponent />, {
 *     storeOverrides: {
 *       setup: {
 *         setupState: { currentStep: 2, isComplete: false, selectedGames: ['poe1'] },
 *       },
 *     },
 *   });
 */

import { cleanup, type RenderOptions, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { afterEach } from "vitest";

import {
  createTestStore,
  type StoreOverrides,
  type TestStore,
} from "./test-store";

// ─── Auto-cleanup after each test ──────────────────────────────────────────

afterEach(() => {
  cleanup();
});

// ─── Provider wrapper options ──────────────────────────────────────────────

export interface RenderWithProvidersOptions
  extends Omit<RenderOptions, "wrapper"> {
  /**
   * Deep-partial overrides applied to the Zustand store's initial state.
   * Lets you set up specific scenarios without going through hydration.
   */
  storeOverrides?: StoreOverrides;

  /**
   * If you already have a store instance (e.g. from `createTestStore()`),
   * pass it here to reuse it rather than creating a new one.
   */
  store?: TestStore;
}

// ─── Result type (extends RTL's render result with extras) ─────────────────

export interface RenderWithProvidersResult extends ReturnType<typeof render> {
  /** The Zustand store instance used for this render. */
  store: TestStore;
  /** A pre-configured `userEvent` instance with `advanceTimers` support. */
  user: ReturnType<typeof userEvent.setup>;
}

// ─── renderWithProviders ───────────────────────────────────────────────────

/**
 * Render a React element wrapped in all the providers the app uses.
 *
 * Currently this includes:
 * - Zustand store (via direct import — Zustand v5 doesn't need a Provider,
 *   but having a dedicated test store ensures isolation)
 *
 * When TanStack Router context or other providers are needed for specific
 * component tests, they can be added to the `Wrapper` below or composed
 * in individual test files.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const { storeOverrides, store: existingStore, ...renderOptions } = options;

  const store = existingStore ?? createTestStore(storeOverrides);

  // Create a user-event instance. We use `advanceTimers` with vi.advanceTimersByTime
  // so that fake timers work seamlessly with user-event's internal delays.
  const user = userEvent.setup({
    // If fake timers are active, this makes user-event advance them automatically.
    // If real timers are active, this is a harmless no-op wrapper.
    advanceTimers: (ms) => {
      try {
        vi.advanceTimersByTime(ms);
      } catch {
        // Real timers are active — fall through to natural setTimeout behavior.
      }
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    // Zustand v5 with vanilla `create()` doesn't require a React context
    // provider — the store is accessed directly via the hook. For tests,
    // the `window.electron` mock (installed in setup.ts beforeEach) and
    // the isolated store instance give us full control.
    //
    // If components under test import `useBoundStore` directly, those tests
    // should either:
    //   a) Test the slice logic via `createTestStore()` (unit test), or
    //   b) Use `vi.mock('~/renderer/store', ...)` to inject the test store.
    //
    // This wrapper is a natural extension point for when we add TanStack
    // Router context, theme providers, or other app-level context.
    return <>{children}</>;
  }

  const renderResult = render(ui, {
    wrapper: Wrapper,
    ...renderOptions,
  });

  return {
    ...renderResult,
    store,
    user,
  };
}

export { act, screen, waitFor, within } from "@testing-library/react";

/**
 * Re-export common testing utilities for convenience so test files only
 * need a single import from this module.
 */
export { userEvent };
