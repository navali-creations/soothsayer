import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";
import { decodeRaritySourceValue } from "~/renderer/utils";

import CurrentSessionActions from "./CurrentSessionActions";

// ─── Mocks ─────────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("motion/react", async () => {
  const { createMotionMock } = await import(
    "~/renderer/__test-setup__/motion-mock"
  );
  return createMotionMock();
});

vi.mock("~/renderer/components", () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
  Flex: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  RaritySourceSelect: ({
    value,
    onChange,
    disabled,
    groups,
    ...props
  }: any) => (
    <div data-testid="rarity-source-select-wrapper">
      <select
        data-testid="rarity-source-select"
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
        disabled={disabled}
        {...props}
      >
        <option value="poe.ninja">poe.ninja</option>
      </select>
      {/* Render menuLabels so DatasetMenuLabel JSX is exercised */}
      {groups?.map((g: any, gi: number) => (
        <div key={gi}>
          {g.options?.map((opt: any) =>
            opt.menuLabel ? (
              <span key={opt.value} data-testid={`menu-label-${opt.value}`}>
                {opt.menuLabel}
              </span>
            ) : null,
          )}
          {g.action && (
            <span data-testid={`group-action-${gi}`}>
              {g.action.loading
                ? g.action.loadingLabel || g.action.label
                : g.action.label}
            </span>
          )}
        </div>
      ))}
    </div>
  ),
}));

vi.mock("~/renderer/utils", () => ({
  decodeRaritySourceValue: vi.fn((v: string) => ({
    raritySource: v,
    filterId: null,
  })),
  encodeRaritySourceValue: vi.fn((source: string, filterId: any) =>
    filterId ? `filter:${filterId}` : source,
  ),
  getAnalyticsRaritySource: vi.fn(() => "poe.ninja"),
}));

const mockDecodeRaritySourceValue = vi.mocked(decodeRaritySourceValue);

vi.mock("react-icons/fi", () => ({
  FiPlay: () => <span data-testid="icon-play" />,
  FiRefreshCw: () => <span data-testid="icon-refresh" />,
}));

vi.mock("react-icons/gi", () => ({
  GiCardExchange: () => <span data-testid="icon-exchange" />,
  GiLockedChest: () => <span data-testid="icon-chest" />,
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockStore(overrides: any = {}) {
  return {
    currentSession: {
      getIsCurrentSessionActive: vi.fn(() => false),
      isLoading: false,
      startSession: vi.fn(),
      stopSession: vi.fn(),
      ...overrides.currentSession,
    },
    settings: {
      raritySource: "poe.ninja",
      selectedFilterId: null,
      updateSetting: vi.fn(),
      getActiveGameViewPriceSource: vi.fn(() => "exchange"),
      setActiveGameViewPriceSource: vi.fn(),
      ...overrides.settings,
    },
    rarityInsights: {
      availableFilters: [],
      isScanning: false,
      lastScannedAt: null,
      scanFilters: vi.fn(),
      selectFilter: vi.fn(),
      clearSelectedFilter: vi.fn(),
      getLocalFilters: vi.fn(() => []),
      getOnlineFilters: vi.fn(() => []),
      ...overrides.rarityInsights,
    },
  } as any;
}

function setupStore(overrides: any = {}) {
  const store = createMockStore(overrides);
  mockUseBoundStore.mockReturnValue(store);
  return store;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CurrentSessionActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Start / Stop / Loading states ──────────────────────────────────────

  it("renders Start Session button when not active and not loading", () => {
    setupStore();
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Start Session")).toBeInTheDocument();
  });

  it("renders Stop Session button when active", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Stop Session")).toBeInTheDocument();
  });

  it('renders loading state ("Starting session...") when isLoading', () => {
    setupStore({
      currentSession: {
        isLoading: true,
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Starting session...")).toBeInTheDocument();
  });

  it("Start Session button calls startSession()", async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<CurrentSessionActions />);

    const startButton = screen.getByText("Start Session").closest("button")!;
    await user.click(startButton);

    expect(store.currentSession.startSession).toHaveBeenCalled();
  });

  it("Stop Session button calls stopSession()", async () => {
    const store = setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
      },
    });
    const { user } = renderWithProviders(<CurrentSessionActions />);

    const stopButton = screen.getByText("Stop Session").closest("button")!;
    await user.click(stopButton);

    expect(store.currentSession.stopSession).toHaveBeenCalled();
  });

  // ── Price Source Tabs ──────────────────────────────────────────────────

  it("renders Exchange and Stash price source tabs", () => {
    setupStore();
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Exchange")).toBeInTheDocument();
    expect(screen.getByText("Stash")).toBeInTheDocument();
  });

  it("Exchange tab is active by default", () => {
    setupStore();
    renderWithProviders(<CurrentSessionActions />);

    const exchangeTab = screen.getByText("Exchange").closest("button")!;
    expect(exchangeTab).toHaveClass("tab-active");
  });

  it('clicking Stash tab calls setActiveGameViewPriceSource("stash")', async () => {
    const store = setupStore();
    const { user } = renderWithProviders(<CurrentSessionActions />);

    const stashTab = screen.getByText("Stash").closest("button")!;
    await user.click(stashTab);

    expect(store.settings.setActiveGameViewPriceSource).toHaveBeenCalledWith(
      "stash",
    );
  });

  // ── RaritySourceSelect ─────────────────────────────────────────────────

  it("RaritySourceSelect is disabled when session is active", () => {
    setupStore({
      currentSession: {
        getIsCurrentSessionActive: vi.fn(() => true),
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    const select = screen.getByTestId("rarity-source-select");
    expect(select).toBeDisabled();
  });

  // ── data-onboarding attributes ─────────────────────────────────────────

  it("has data-onboarding attributes", () => {
    setupStore();
    renderWithProviders(<CurrentSessionActions />);

    expect(
      document.querySelector(
        '[data-onboarding="current-session-rarity-source"]',
      ),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-onboarding="start-session"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-onboarding="current-session-pricing"]'),
    ).toBeInTheDocument();
  });

  // ── Filter selection branch ────────────────────────────────────────────

  it("selecting a filter source calls selectFilter and updateSetting with filterId", async () => {
    mockDecodeRaritySourceValue.mockReturnValueOnce({
      raritySource: "filter" as any,
      filterId: "f1",
    });

    const store = setupStore();
    const { user } = renderWithProviders(<CurrentSessionActions />);

    const select = screen.getByTestId("rarity-source-select");
    await user.selectOptions(select, "poe.ninja");

    expect(store.rarityInsights.selectFilter).toHaveBeenCalledWith("f1");
    expect(store.settings.updateSetting).toHaveBeenCalledWith(
      "selectedFilterId",
      "f1",
    );
  });

  // ── Clear filter branch ────────────────────────────────────────────────

  it("switching away from a filter clears the selected filter", async () => {
    const store = setupStore({
      settings: {
        selectedFilterId: "f1",
        raritySource: "filter",
      },
    });
    const { user } = renderWithProviders(<CurrentSessionActions />);

    const select = screen.getByTestId("rarity-source-select");
    await user.selectOptions(select, "poe.ninja");

    expect(store.rarityInsights.clearSelectedFilter).toHaveBeenCalled();
    expect(store.settings.updateSetting).toHaveBeenCalledWith(
      "selectedFilterId",
      null,
    );
  });

  // ── Filter options mapping ─────────────────────────────────────────────

  it("renders without error when local and online filters are populated", () => {
    setupStore({
      rarityInsights: {
        getLocalFilters: vi.fn(() => [
          { id: "local1", name: "Local Filter 1", isOutdated: false },
        ]),
        getOnlineFilters: vi.fn(() => [
          { id: "online1", name: "Online Filter 1", isOutdated: true },
        ]),
        lastScannedAt: Date.now(),
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByTestId("rarity-source-select")).toBeInTheDocument();
  });

  // ── DatasetMenuLabel rendering ─────────────────────────────────────────

  it("renders DatasetMenuLabel with label text and superscript hint for dataset options", () => {
    setupStore();
    renderWithProviders(<CurrentSessionActions />);

    // The mock RaritySourceSelect now renders menuLabel content
    const ninjaLabel = screen.getByTestId("menu-label-poe.ninja");
    expect(ninjaLabel).toBeInTheDocument();
    expect(ninjaLabel).toHaveTextContent("poe.ninja");
    expect(ninjaLabel).toHaveTextContent("?");

    const prohibitedLabel = screen.getByTestId("menu-label-prohibited-library");
    expect(prohibitedLabel).toBeInTheDocument();
    expect(prohibitedLabel).toHaveTextContent("Prohibited Library");
    expect(prohibitedLabel).toHaveTextContent("?");
  });

  it("DatasetMenuLabel has dotted border and title hint", () => {
    setupStore();
    renderWithProviders(<CurrentSessionActions />);

    const ninjaLabel = screen.getByTestId("menu-label-poe.ninja");
    const innerSpan = ninjaLabel.querySelector("span.border-b");
    expect(innerSpan).toBeInTheDocument();
    expect(innerSpan).toHaveAttribute(
      "title",
      "Price based rarity from poe.ninja market data",
    );
  });

  // ── Exchange tab click ─────────────────────────────────────────────────

  // ── Scanning state (L115-122) ──────────────────────────────────────────

  it("shows Scanning... loading state when isScanning is true and filters exist", () => {
    setupStore({
      rarityInsights: {
        isScanning: true,
        lastScannedAt: Date.now(),
        availableFilters: [],
        getLocalFilters: vi.fn(() => []),
        getOnlineFilters: vi.fn(() => []),
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Scanning...")).toBeInTheDocument();
  });

  it("shows Scan for filters when lastScannedAt is null and not scanning", () => {
    setupStore({
      rarityInsights: {
        isScanning: false,
        lastScannedAt: null,
        availableFilters: [],
        getLocalFilters: vi.fn(() => []),
        getOnlineFilters: vi.fn(() => []),
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Scan for filters")).toBeInTheDocument();
  });

  it("shows Rescan filters when lastScannedAt is set, not scanning, and no filters found", () => {
    setupStore({
      rarityInsights: {
        isScanning: false,
        lastScannedAt: Date.now(),
        availableFilters: [],
        getLocalFilters: vi.fn(() => []),
        getOnlineFilters: vi.fn(() => []),
      },
    });
    renderWithProviders(<CurrentSessionActions />);

    expect(screen.getByText("Rescan filters")).toBeInTheDocument();
  });

  it('clicking Exchange tab calls setActiveGameViewPriceSource("exchange")', async () => {
    const store = setupStore({
      settings: {
        getActiveGameViewPriceSource: vi.fn(() => "stash"),
      },
    });
    const { user } = renderWithProviders(<CurrentSessionActions />);

    const exchangeTab = screen.getByText("Exchange").closest("button")!;
    await user.click(exchangeTab);

    expect(store.settings.setActiveGameViewPriceSource).toHaveBeenCalledWith(
      "exchange",
    );
  });
});
