import { describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import ChangelogPage from "./Changelog.page";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useBoundStore: vi.fn(),
}));

vi.mock("~/renderer/components", () => ({
  PageContainer: Object.assign(
    ({ children }: any) => <div data-testid="page-container">{children}</div>,
    {
      Header: ({ title, subtitle }: any) => (
        <div data-testid="page-header">
          <span>{title}</span>
          {subtitle && <span data-testid="subtitle">{subtitle}</span>}
        </div>
      ),
      Content: ({ children }: any) => (
        <div data-testid="page-content">{children}</div>
      ),
    },
  ),
}));

vi.mock("../Changelog.components", () => ({
  ReleaseTimelineItem: ({ release, isLast, isCurrent }: any) => (
    <li
      data-testid={`release-${release.version}`}
      data-last={isLast}
      data-current={isCurrent}
    >
      {release.version}
    </li>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    changelog: {
      releases: [],
      isLoading: false,
      error: null,
      fetchChangelog: vi.fn(),
      ...overrides,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ChangelogPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── fetchChangelog on mount ────────────────────────────────────────────

  it("calls fetchChangelog on mount", () => {
    const store = setupStore();
    renderWithProviders(<ChangelogPage />);

    expect(store.changelog.fetchChangelog).toHaveBeenCalledTimes(1);
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it("shows loading spinner when isLoading is true", () => {
    setupStore({ isLoading: true });
    const { container } = renderWithProviders(<ChangelogPage />);

    const spinner = container.querySelector(".loading-spinner");
    expect(spinner).toBeInTheDocument();
  });

  it('shows "Loading..." subtitle when isLoading is true', () => {
    setupStore({ isLoading: true });
    renderWithProviders(<ChangelogPage />);

    const subtitle = screen.getByTestId("subtitle");
    expect(subtitle).toHaveTextContent("Loading...");
  });

  // ── Error state ────────────────────────────────────────────────────────

  it("shows error message when error is set", () => {
    setupStore({ error: "Something went wrong" });
    renderWithProviders(<ChangelogPage />);

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it('shows "Error" subtitle when error is set', () => {
    setupStore({ error: "Something went wrong" });
    renderWithProviders(<ChangelogPage />);

    const subtitle = screen.getByTestId("subtitle");
    expect(subtitle).toHaveTextContent("Error");
  });

  // ── Normal state (with releases) ──────────────────────────────────────

  it('shows "Changelog" title in normal state', () => {
    setupStore({
      releases: [{ version: "1.0.0" }],
    });
    renderWithProviders(<ChangelogPage />);

    expect(screen.getByText("Changelog")).toBeInTheDocument();
  });

  it('shows "Release history and updates." subtitle text', () => {
    setupStore({
      releases: [{ version: "1.0.0" }],
    });
    renderWithProviders(<ChangelogPage />);

    const subtitle = screen.getByTestId("subtitle");
    expect(subtitle).toHaveTextContent("Release history and updates.");
  });

  it("shows GitHub hint text", () => {
    setupStore({
      releases: [{ version: "1.0.0" }],
    });
    renderWithProviders(<ChangelogPage />);

    expect(
      screen.getByText("Click on any card to open the release page on GitHub."),
    ).toBeInTheDocument();
  });

  it("renders ReleaseTimelineItem for each release with correct isLast and isCurrent props", () => {
    setupStore({
      releases: [
        { version: "3.0.0" },
        { version: "2.0.0" },
        { version: "1.0.0" },
      ],
    });
    renderWithProviders(<ChangelogPage />);

    const first = screen.getByTestId("release-3.0.0");
    const second = screen.getByTestId("release-2.0.0");
    const third = screen.getByTestId("release-1.0.0");

    // First item is current
    expect(first).toHaveAttribute("data-current", "true");
    expect(first).toHaveAttribute("data-last", "false");

    // Middle item is neither current nor last
    expect(second).toHaveAttribute("data-current", "false");
    expect(second).toHaveAttribute("data-last", "false");

    // Last item is last but not current
    expect(third).toHaveAttribute("data-current", "false");
    expect(third).toHaveAttribute("data-last", "true");
  });

  // ── Empty state ────────────────────────────────────────────────────────

  it('shows "No changelog entries found." when releases is empty', () => {
    setupStore({ releases: [] });
    renderWithProviders(<ChangelogPage />);

    expect(screen.getByText("No changelog entries found.")).toBeInTheDocument();
  });
});
