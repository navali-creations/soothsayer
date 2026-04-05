import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import DiskSpaceWarning from "./DiskSpaceWarning";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => {
  const useBoundStore = vi.fn();
  return {
    useBoundStore,
    useCurrentSession: () => useBoundStore().currentSession,
    useSettings: () => useBoundStore().settings,
    usePoeNinja: () => useBoundStore().poeNinja,
    useSessionDetails: () => useBoundStore().sessionDetails,
    useOverlay: () => useBoundStore().overlay,
    useAppMenu: () => useBoundStore().appMenu,
    useSetup: () => useBoundStore().setup,
    useStorage: () => useBoundStore().storage,
    useGameInfo: () => useBoundStore().gameInfo,
    useCards: () => useBoundStore().cards,
    useSessions: () => useBoundStore().sessions,
    useChangelog: () => useBoundStore().changelog,
    useStatistics: () => useBoundStore().statistics,
    useOnboarding: () => useBoundStore().onboarding,
    useUpdater: () => useBoundStore().updater,
    useProfitForecast: () => useBoundStore().profitForecast,
    useProhibitedLibrary: () => useBoundStore().prohibitedLibrary,
    useRarityInsights: () => useBoundStore().rarityInsights,
    useRarityInsightsComparison: () => useBoundStore().rarityInsightsComparison,
    useRootActions: () => {
      const s = useBoundStore();
      return {
        hydrate: s.hydrate,
        startListeners: s.startListeners,
        reset: s.reset,
      };
    },
    useSlice: (key: string) => useBoundStore()?.[key],
  };
});

const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    storage: {
      isDiskLow: false,
      info: null,
      ...overrides.storage,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("DiskSpaceWarning", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when isDiskLow is false", () => {
    setupStore({ storage: { isDiskLow: false, info: null } });

    const { container } = renderWithProviders(<DiskSpaceWarning />);

    expect(container.innerHTML).toBe("");
  });

  it("renders warning icon when isDiskLow is true", () => {
    setupStore({
      storage: { isDiskLow: true, info: { diskFreeBytes: 500_000_000 } },
    });

    const { container } = renderWithProviders(<DiskSpaceWarning />);

    expect(container.innerHTML).not.toBe("");
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows tooltip with free space info", () => {
    setupStore({
      storage: { isDiskLow: true, info: { diskFreeBytes: 500_000_000 } },
    });

    renderWithProviders(<DiskSpaceWarning />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip?.getAttribute("data-tip")).toContain("Low disk space");
    expect(tooltip?.getAttribute("data-tip")).toContain("free");
  });

  it("shows 0 B free when info is null", () => {
    setupStore({
      storage: { isDiskLow: true, info: null },
    });

    renderWithProviders(<DiskSpaceWarning />);

    const tooltip = document.querySelector("[data-tip]");
    expect(tooltip?.getAttribute("data-tip")).toContain("0 B free");
  });

  it("clicking the button navigates to settings", async () => {
    setupStore({
      storage: { isDiskLow: true, info: { diskFreeBytes: 100_000_000 } },
    });

    const { user } = renderWithProviders(<DiskSpaceWarning />);

    await user.click(screen.getByRole("button"));

    expect(mockNavigate).toHaveBeenCalledWith({ to: "/settings" });
  });

  it("applies warning text class to the button", () => {
    setupStore({
      storage: { isDiskLow: true, info: { diskFreeBytes: 100_000_000 } },
    });

    renderWithProviders(<DiskSpaceWarning />);

    const button = screen.getByRole("button");
    expect(button.className).toContain("text-warning");
  });

  it("applies tooltip-warning class to the tooltip container", () => {
    setupStore({
      storage: { isDiskLow: true, info: { diskFreeBytes: 100_000_000 } },
    });

    renderWithProviders(<DiskSpaceWarning />);

    const tooltip = document.querySelector(".tooltip");
    expect(tooltip).toBeInTheDocument();
    expect(tooltip?.classList.contains("tooltip-warning")).toBe(true);
  });
});
