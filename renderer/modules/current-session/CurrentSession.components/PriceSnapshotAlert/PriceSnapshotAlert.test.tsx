import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

import PriceSnapshotAlert from "./PriceSnapshotAlert";

vi.mock("~/renderer/store", async () => {
  const { createStoreMock } = await import(
    "~/renderer/__test-setup__/store-mock"
  );
  return createStoreMock();
});

vi.mock("~/renderer/components", () => ({
  Countdown: ({ timer }: any) => (
    <span data-testid="countdown">
      {String(timer.hours).padStart(2, "0")}:
      {String(timer.minutes).padStart(2, "0")}:
      {String(timer.seconds).padStart(2, "0")}
    </span>
  ),
}));

const mockUseBoundStore = vi.mocked(useBoundStore);

const FIXED_TIMESTAMP = "2024-06-15T12:00:00.000Z";

function createSession(overrides: any = {}) {
  return {
    priceSnapshot: {
      timestamp: FIXED_TIMESTAMP,
      chaosToDivineRatio: 220,
      cardPrices: {},
      stackedDeckChaosCost: 2,
      ...overrides.priceSnapshot,
    },
    snapshotId: overrides.snapshotId ?? "snap-abcdef1234567890",
    totalCount: overrides.totalCount ?? 10,
    cards: overrides.cards ?? [],
    totals: {
      chaosToDivineRatio: 220,
      totalValue: 500,
      netProfit: 300,
      stackedDeckChaosCost: 2,
      totalDeckCost: 200,
      ...overrides.totals,
    },
    ...overrides,
  };
}

function createCurrentSnapshot(overrides: any = {}) {
  return {
    id: overrides.id ?? "live-snap-999",
    fetchedAt: overrides.fetchedAt ?? FIXED_TIMESTAMP,
    chaosToDivineRatio: overrides.chaosToDivineRatio ?? 220,
    ...overrides,
  };
}

function setupStore(overrides: any = {}) {
  const currentSession = {
    getSession: vi.fn(() => overrides.session ?? null),
    getSessionInfo: vi.fn(() => overrides.sessionInfo ?? null),
  };
  const poeNinja = {
    currentSnapshot: overrides.currentSnapshot ?? null,
    isAutoRefreshActive: vi.fn(() => overrides.isAutoRefreshActive ?? false),
    getTimeUntilNextRefresh: vi.fn(
      () => overrides.timeUntilNextRefresh ?? null,
    ),
  };

  mockUseBoundStore.mockReturnValue({
    currentSession,
    poeNinja,
  } as any);

  return { currentSession, poeNinja };
}

describe("PriceSnapshotAlert", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null when there is no snapshot data", () => {
    setupStore();

    const { container } = renderWithProviders(<PriceSnapshotAlert />);

    expect(container.innerHTML).toBe("");
  });

  it("returns null when session has no priceSnapshot and currentSnapshot is null", () => {
    setupStore({
      session: createSession({
        priceSnapshot: null,
        totals: null,
        snapshotId: null,
      }),
      currentSnapshot: null,
    });

    const { container } = renderWithProviders(<PriceSnapshotAlert />);

    expect(container.innerHTML).toBe("");
  });

  it("renders a success alert when session has a price snapshot", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-success");
  });

  it("renders a success alert when only currentSnapshot exists", () => {
    setupStore({
      currentSnapshot: createCurrentSnapshot(),
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const alert = document.querySelector(".alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveClass("alert-success");
  });

  it("renders exchange snapshot copy with the session divine ratio", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(
      screen.getByText(/Using poe\.ninja exchange pricing snapshot/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Divine = 220\.00c/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot: snap-abc\.\.\./)).toBeInTheDocument();
    expect(
      screen.getByText("Use checkboxes to hide anomalous prices"),
    ).toBeInTheDocument();
  });

  it("falls back to the current snapshot when the session has no snapshot", () => {
    setupStore({
      currentSnapshot: createCurrentSnapshot({
        id: "fallback-abcdef123456",
        chaosToDivineRatio: 215,
      }),
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 215\.00c/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot: fallback/)).toBeInTheDocument();
  });

  it("falls back to currentSnapshot for divine ratio when session totals are missing", () => {
    setupStore({
      session: createSession({
        totals: null,
      }),
      currentSnapshot: createCurrentSnapshot({
        chaosToDivineRatio: 215,
      }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 215\.00c/)).toBeInTheDocument();
  });

  it("uses the current snapshot only when the session has no price snapshot", () => {
    setupStore({
      session: createSession({
        priceSnapshot: null,
        snapshotId: null,
        totals: { chaosToDivineRatio: 0 },
      }),
      currentSnapshot: createCurrentSnapshot({
        id: "live-abcdef123456",
        fetchedAt: "2024-06-15T12:30:00.000Z",
        chaosToDivineRatio: 205,
      }),
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Divine = 205\.00c/)).toBeInTheDocument();
    expect(screen.getByText(/Snapshot: live-abc/)).toBeInTheDocument();
  });

  it("omits snapshot id text when neither snapshot has an id", () => {
    setupStore({
      session: createSession({ snapshotId: null }),
      currentSnapshot: createCurrentSnapshot({ id: null }),
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Snapshot:/)).not.toBeInTheDocument();
  });

  it("does not show divine ratio text when the ratio is zero", () => {
    setupStore({
      session: createSession({
        totals: { chaosToDivineRatio: 0 },
      }),
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Divine =/)).not.toBeInTheDocument();
  });

  it("shows truncated snapshot ID from session", () => {
    setupStore({
      session: createSession({ snapshotId: "abcdef1234567890extra" }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Snapshot: abcdef12\.\.\./)).toBeInTheDocument();
  });

  it("shows countdown when auto-refresh is active", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: true,
      timeUntilNextRefresh: (1 * 3600 + 23 * 60 + 45) * 1000,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Next refresh in:/)).toBeInTheDocument();
    expect(screen.getByTestId("countdown")).toBeInTheDocument();
  });

  it("shows refreshing text when auto-refresh is active without remaining time", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: true,
      timeUntilNextRefresh: 0,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Refreshing soon\.\.\./)).toBeInTheDocument();
  });

  it("shows refreshing text when auto-refresh is active and remaining time is null", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: true,
      timeUntilNextRefresh: null,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Refreshing soon\.\.\./)).toBeInTheDocument();
  });

  it("does not show refresh text when auto-refresh is inactive", () => {
    setupStore({
      session: createSession(),
      sessionInfo: { league: "poe1:Settlers" },
      isAutoRefreshActive: false,
      timeUntilNextRefresh: 60_000,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Next refresh in:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Refreshing soon/)).not.toBeInTheDocument();
  });

  it("shows rarities-updated notice when the live snapshot is newer", () => {
    setupStore({
      session: createSession({
        priceSnapshot: { timestamp: "2024-06-15T12:00:00.000Z" },
      }),
      currentSnapshot: createCurrentSnapshot({
        fetchedAt: "2024-06-15T12:05:00.000Z",
      }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Rarities updated/)).toBeInTheDocument();
  });

  it("does not show rarities-updated notice for same-minute snapshots", () => {
    setupStore({
      session: createSession({
        priceSnapshot: { timestamp: "2024-06-15T12:00:00.000Z" },
      }),
      currentSnapshot: createCurrentSnapshot({
        fetchedAt: "2024-06-15T12:00:30.000Z",
      }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Rarities updated/)).not.toBeInTheDocument();
  });

  it("does not show rarities-updated notice when currentSnapshot is null", () => {
    setupStore({
      session: createSession(),
      currentSnapshot: null,
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.queryByText(/Rarities updated/)).not.toBeInTheDocument();
  });

  it("passes parsed game and league to auto-refresh lookup", () => {
    const { poeNinja } = setupStore({
      session: createSession(),
      sessionInfo: { league: "poe2:Dawn" },
      isAutoRefreshActive: true,
      timeUntilNextRefresh: 60_000,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(poeNinja.isAutoRefreshActive).toHaveBeenCalledWith("poe2", "Dawn");
    expect(poeNinja.getTimeUntilNextRefresh).toHaveBeenCalledWith(
      "poe2",
      "Dawn",
    );
  });

  it("does not query auto-refresh state when the session league is missing", () => {
    const { poeNinja } = setupStore({
      session: createSession(),
      sessionInfo: {},
      isAutoRefreshActive: true,
      timeUntilNextRefresh: 60_000,
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(poeNinja.isAutoRefreshActive).not.toHaveBeenCalled();
    expect(poeNinja.getTimeUntilNextRefresh).not.toHaveBeenCalled();
  });

  it("displays the session snapshot timestamp in the alert", () => {
    const timestamp = "2024-01-15T10:30:00.000Z";

    setupStore({
      session: createSession({
        priceSnapshot: { timestamp },
      }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const expectedText = new Date(timestamp).toLocaleString();
    expect(
      screen.getByText(
        new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    ).toBeInTheDocument();
  });

  it("falls back to currentSnapshot.fetchedAt when session priceSnapshot has no timestamp", () => {
    const fetchedAt = "2024-03-20T08:00:00.000Z";

    setupStore({
      session: createSession({
        priceSnapshot: { timestamp: null },
      }),
      currentSnapshot: createCurrentSnapshot({ fetchedAt }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const expectedText = new Date(fetchedAt).toLocaleString();
    expect(
      screen.getByText(
        new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    ).toBeInTheDocument();
  });

  it("falls back to current time when both snapshot timestamps are missing", () => {
    const now = new Date("2024-05-01T09:15:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);

    setupStore({
      session: createSession({
        priceSnapshot: { timestamp: null },
      }),
      currentSnapshot: createCurrentSnapshot({ fetchedAt: null }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    const expectedText = now.toLocaleString();
    expect(
      screen.getByText(
        new RegExp(expectedText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      ),
    ).toBeInTheDocument();
  });

  it("falls back to currentSnapshot.id when session has no snapshotId", () => {
    setupStore({
      session: createSession({ snapshotId: null }),
      currentSnapshot: createCurrentSnapshot({ id: "fallback-abcdef123456" }),
      sessionInfo: { league: "poe1:Settlers" },
    });

    renderWithProviders(<PriceSnapshotAlert />);

    expect(screen.getByText(/Snapshot: fallback/)).toBeInTheDocument();
  });
});
