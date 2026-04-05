import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderWithProviders,
  screen,
  waitFor,
} from "~/renderer/__test-setup__/render";
import { useProhibitedLibrary, useSettings } from "~/renderer/store";

import ProhibitedLibraryStatusBlock from "./ProhibitedLibraryStatusBlock";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useProhibitedLibrary: vi.fn(),
  useSettings: vi.fn(),
}));

const mockUseProhibitedLibrary = vi.mocked(useProhibitedLibrary);
const mockUseSettings = vi.mocked(useSettings);

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {loading ? "Loading..." : children}
    </button>
  ),
}));

vi.mock("react-icons/fi", () => ({
  FiDatabase: () => <span data-testid="icon-database" />,
  FiRefreshCw: () => <span data-testid="icon-refresh" />,
}));

vi.mock("~/renderer/utils", () => ({
  formatRelativeTime: vi.fn((date: string) => `mocked-relative(${date})`),
}));

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: vi.fn(),
}));

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    prohibitedLibrary: {
      poe1Status: null,
      poe2Status: null,
      isLoading: false,
      loadError: null,
      reload: vi.fn().mockResolvedValue(undefined),
      ...overrides.prohibitedLibrary,
    },
    settings: {
      getSelectedGame: vi.fn(() => "poe1"),
      getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      ...overrides.settings,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);

  mockUseProhibitedLibrary.mockReturnValue(store.prohibitedLibrary);
  mockUseSettings.mockReturnValue(store.settings);

  return store;
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function createStatus(overrides: any = {}) {
  return {
    hasData: true,
    league: "Settlers",
    cardCount: 150,
    appVersion: "1.2.3",
    lastLoadedAt: "2025-01-15T12:00:00Z",
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("ProhibitedLibraryStatusBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore();
  });

  // ── Heading ────────────────────────────────────────────────────────────

  it('renders "Prohibited Library Data" heading', () => {
    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Prohibited Library Data")).toBeInTheDocument();
  });

  // ── Status with data ──────────────────────────────────────────────────

  it("shows league name when status has data", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ league: "Settlers" }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Settlers")).toBeInTheDocument();
  });

  it("shows card count when status has data", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ cardCount: 250 }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("250 cards")).toBeInTheDocument();
  });

  it('shows "Unknown" when league is null', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ league: null }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it('shows "Unknown" when league is undefined', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ league: undefined }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  // ── App version ───────────────────────────────────────────────────────

  it("shows app version when appVersion is present", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ appVersion: "1.2.3" }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("App version")).toBeInTheDocument();
    expect(screen.getByText("v1.2.3")).toBeInTheDocument();
  });

  it("hides app version row when appVersion is null", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ appVersion: null }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.queryByText("App version")).not.toBeInTheDocument();
  });

  it("hides app version row when appVersion is empty string", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ appVersion: "" }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.queryByText("App version")).not.toBeInTheDocument();
  });

  // ── Last loaded ───────────────────────────────────────────────────────

  it("shows last loaded with formatted relative time", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ lastLoadedAt: "2025-01-15T12:00:00Z" }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Last loaded")).toBeInTheDocument();
    expect(
      screen.getByText("mocked-relative(2025-01-15T12:00:00Z)"),
    ).toBeInTheDocument();
  });

  it('shows "Never" when lastLoadedAt is null', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ lastLoadedAt: null }),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  // ── League mismatch warning ───────────────────────────────────────────

  it("shows league mismatch warning when data league differs from active league", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ league: "Necropolis" }),
      },
      settings: {
        getSelectedGame: vi.fn(() => "poe1"),
        getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText(/Showing data from/)).toHaveTextContent(
      "Necropolis",
    );
    expect(
      screen.getByText(/Update available in next app release/),
    ).toBeInTheDocument();
  });

  it("hides league mismatch warning when leagues match", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ league: "Settlers" }),
      },
      settings: {
        getSelectedGame: vi.fn(() => "poe1"),
        getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(
      screen.queryByText(/Update available in next app release/),
    ).not.toBeInTheDocument();
  });

  // ── No data states ────────────────────────────────────────────────────

  it('shows "No data loaded yet" when status has no data and not loading', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: null,
        isLoading: false,
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("No data loaded yet")).toBeInTheDocument();
  });

  it('shows "Loading status…" when isLoading is true and no data', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: null,
        isLoading: true,
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Loading status…")).toBeInTheDocument();
  });

  // ── Error state ───────────────────────────────────────────────────────

  it("shows error message when loadError is set", () => {
    setupStore({
      prohibitedLibrary: {
        loadError: "Failed to load prohibited library data",
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(
      screen.getByText("Failed to load prohibited library data"),
    ).toBeInTheDocument();
  });

  // ── Reload button ─────────────────────────────────────────────────────

  it("calls reload() when Reload button is clicked", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<ProhibitedLibraryStatusBlock />);

    const reloadButton = screen.getByRole("button", { name: /Reload/i });
    await user.click(reloadButton);

    await waitFor(() => {
      expect(store.prohibitedLibrary.reload).toHaveBeenCalledTimes(1);
    });
  });

  it("Reload button is disabled when isLoading is true", () => {
    setupStore({
      prohibitedLibrary: {
        isLoading: true,
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    const reloadButton = screen.getByRole("button", { name: /Loading/i });
    expect(reloadButton).toBeDisabled();
  });

  // ── Cross-game status messages ────────────────────────────────────────

  it('shows "No PoE2 data bundled yet" when activeGame is poe1 and poe2Status.hasData is false', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus(),
        poe2Status: { hasData: false },
      },
      settings: {
        getSelectedGame: vi.fn(() => "poe1"),
        getActiveGameViewSelectedLeague: vi.fn(() => "Settlers"),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("No PoE2 data bundled yet")).toBeInTheDocument();
  });

  it('shows "No PoE1 data bundled yet" when activeGame is poe2 and poe1Status.hasData is false', () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: { hasData: false },
        poe2Status: createStatus(),
      },
      settings: {
        getSelectedGame: vi.fn(() => "poe2"),
        getActiveGameViewSelectedLeague: vi.fn(() => "Dawn"),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("No PoE1 data bundled yet")).toBeInTheDocument();
  });

  // ── Game selection determines which status is shown ────────────────────

  it("shows poe2Status data when activeGame is poe2", () => {
    setupStore({
      prohibitedLibrary: {
        poe1Status: createStatus({ league: "Settlers", cardCount: 100 }),
        poe2Status: createStatus({ league: "Dawn", cardCount: 75 }),
      },
      settings: {
        getSelectedGame: vi.fn(() => "poe2"),
        getActiveGameViewSelectedLeague: vi.fn(() => "Dawn"),
      },
    });

    renderWithProviders(<ProhibitedLibraryStatusBlock />);

    expect(screen.getByText("Dawn")).toBeInTheDocument();
    expect(screen.getByText("75 cards")).toBeInTheDocument();
  });
});
