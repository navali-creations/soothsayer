import { vi } from "vitest";

// ─── Router mock factories for @tanstack/react-router ──────────────────────
//
// 19+ test files duplicate router mocks with slight variants.
// Test files still call `vi.mock("@tanstack/react-router", ...)` themselves
// (because vi.mock is hoisted), but delegate the mock object to these factories.
//
// Usage (inside a test file):
//
//   import { createRouterMock } from "~/renderer/__test-setup__/router-mock";
//
//   const { mockNavigate, mockHistoryBack } = vi.hoisted(() => ({
//     mockNavigate: vi.fn(),
//     mockHistoryBack: vi.fn(),
//   }));
//
//   vi.mock("@tanstack/react-router", () =>
//     createRouterMock({ mockNavigate, mockHistoryBack }),
//   );
//

export interface RouterMockOptions {
  /**
   * When provided, `useNavigate` returns this fn directly.
   * When omitted, `useNavigate` returns `vi.fn()` (a fresh no-op mock).
   */
  mockNavigate?: ReturnType<typeof vi.fn>;

  /**
   * When provided, `useRouter` returns `{ history: { back: mockHistoryBack } }`.
   * When omitted, `useRouter` is not included in the mock.
   */
  mockHistoryBack?: ReturnType<typeof vi.fn>;

  /**
   * When provided, `useParams` returns this value (or calls this fn).
   * Accepts either a plain object or a mock fn.
   * When omitted, `useParams` is not included in the mock.
   */
  useParamsReturn?: Record<string, unknown> | ReturnType<typeof vi.fn>;

  /**
   * When true, includes a stub `Link` component that renders an `<a>` tag.
   * Default: false.
   */
  includeLink?: boolean;

  /**
   * When true, includes a stub `createLink` that returns a passthrough component.
   * Default: false.
   */
  includeCreateLink?: boolean;
}

/**
 * Creates a mock module object for `@tanstack/react-router`.
 *
 * Covers all observed variants across the codebase:
 *
 * 1. `useNavigate` only (most common — statistics, cards, sessions)
 * 2. `useNavigate` + `useRouter` with history.back (BackButton, SessionDetails)
 * 3. `useNavigate` + `useParams` (CardDetailsPage)
 * 4. `useNavigate` + `useParams` + `useRouter` + `Link` + `createLink` (CardDetailsSimple)
 * 5. `Link` + `createLink` only (Link.test, PFTable, RarityInsights)
 */
export function createRouterMock(options: RouterMockOptions = {}) {
  const {
    mockNavigate,
    mockHistoryBack,
    useParamsReturn,
    includeLink = false,
    includeCreateLink = false,
  } = options;

  const mock: Record<string, unknown> = {};

  // useNavigate — always included (present in almost every variant)
  if (mockNavigate) {
    mock.useNavigate = vi.fn(() => mockNavigate);
  } else {
    // Default: return a fresh vi.fn() each time useNavigate is called
    mock.useNavigate = () => vi.fn();
  }

  // useRouter — included when mockHistoryBack is provided
  if (mockHistoryBack) {
    mock.useRouter = () => ({ history: { back: mockHistoryBack } });
  }

  // useParams — included when a return value is provided
  if (useParamsReturn !== undefined) {
    if (typeof useParamsReturn === "function") {
      mock.useParams = (...args: unknown[]) =>
        (useParamsReturn as (...a: unknown[]) => unknown)(...args);
    } else {
      mock.useParams = () => useParamsReturn;
    }
  }

  // Link — stub <a> tag
  if (includeLink) {
    mock.Link = ({ children, ...props }: any) => {
      // Use dynamic import or inline JSX isn't available in .ts files,
      // so we use createElement-style approach via a tagged template or
      // just return a simple object. Since vi.mock factory runs in a
      // special scope, we return a function component shape.
      const React = require("react");
      return React.createElement("a", props, children);
    };
  }

  // createLink — stub that returns a passthrough component
  if (includeCreateLink) {
    mock.createLink = (Component?: any) => {
      if (Component) {
        const React = require("react");
        return React.forwardRef((props: any, ref: any) =>
          React.createElement(Component, { ...props, ref }),
        );
      }
      return (props: any) => {
        const React = require("react");
        return React.createElement("a", props);
      };
    };
  }

  return mock;
}

/**
 * Convenience preset: navigate-only mock (most common pattern).
 *
 * Used by: CardsGrid, Statistics stats, DiskSpaceWarning, etc.
 */
export function createNavigateOnlyMock(mockNavigate: ReturnType<typeof vi.fn>) {
  return createRouterMock({ mockNavigate });
}

/**
 * Convenience preset: navigate + history.back (BackButton, SessionDetailsActions).
 */
export function createNavigateWithHistoryMock(
  mockNavigate: ReturnType<typeof vi.fn>,
  mockHistoryBack: ReturnType<typeof vi.fn>,
) {
  return createRouterMock({ mockNavigate, mockHistoryBack });
}

/**
 * Convenience preset: full mock with Link stubs (CardDetails, PFTable, RarityInsights).
 */
export function createFullRouterMock(options: RouterMockOptions = {}) {
  return createRouterMock({
    includeLink: true,
    includeCreateLink: true,
    ...options,
  });
}
