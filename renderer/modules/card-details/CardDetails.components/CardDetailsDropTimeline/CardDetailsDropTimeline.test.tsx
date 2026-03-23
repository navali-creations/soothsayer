import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Hook & component mocks ───────────────────────────────────────────────

vi.mock("~/renderer/hooks", () => ({
  useChartColors: vi.fn(() => ({
    primary: "#00f",
    secondary: "#0f0",
    muted: "#999",
    text: "#fff",
    grid: "#333",
    tooltip: "#111",
  })),
}));

const mockUseDropTimelineData = vi.fn();

vi.mock("./useDropTimelineData/useDropTimelineData", () => ({
  useDropTimelineData: (...args: any[]) => mockUseDropTimelineData(...args),
}));

vi.mock("./MainChart", () => ({
  default: () => <div data-testid="main-chart" />,
}));

vi.mock("./OverviewChart", () => ({
  default: () => <div data-testid="overview-chart" />,
}));

// ─── Component import (after all mocks) ────────────────────────────────────

import CardDetailsDropTimeline from "./";

// ─── Helpers ───────────────────────────────────────────────────────────────

function defaultHookReturn(overrides: Record<string, any> = {}) {
  return {
    chartData: [
      {
        time: 1705312800000,
        count: 3,
        cumulativeCount: 3,
        totalDecksOpened: 100,
        league: "Affliction",
        sessionStartedAt: "2024-01-15T10:00:00Z",
        sessionId: "s1",
        sessionCount: 1,
      },
      {
        time: 1705744800000,
        count: 2,
        cumulativeCount: 5,
        totalDecksOpened: 80,
        league: "Affliction",
        sessionStartedAt: "2024-01-20T10:00:00Z",
        sessionId: "s2",
        sessionCount: 1,
      },
      {
        time: 1711965600000,
        count: 1,
        cumulativeCount: 6,
        totalDecksOpened: 50,
        league: "Settlers",
        sessionStartedAt: "2024-04-01T10:00:00Z",
        sessionId: "s3",
        sessionCount: 1,
      },
    ],
    gapIndices: [],
    leagueMarkers: [],
    uniqueLeagues: ["Affliction", "Settlers"],
    brushStartIndex: undefined,
    brushEndIndex: undefined,
    handleBrushChange: vi.fn(),
    visibleData: [
      {
        time: 1705312800000,
        count: 3,
        cumulativeCount: 3,
        totalDecksOpened: 100,
        league: "Affliction",
        sessionStartedAt: "2024-01-15T10:00:00Z",
        sessionId: "s1",
        sessionCount: 1,
      },
      {
        time: 1705744800000,
        count: 2,
        cumulativeCount: 5,
        totalDecksOpened: 80,
        league: "Affliction",
        sessionStartedAt: "2024-01-20T10:00:00Z",
        sessionId: "s2",
        sessionCount: 1,
      },
      {
        time: 1711965600000,
        count: 1,
        cumulativeCount: 6,
        totalDecksOpened: 50,
        league: "Settlers",
        sessionStartedAt: "2024-04-01T10:00:00Z",
        sessionId: "s3",
        sessionCount: 1,
      },
    ],
    maxCumulative: 6,
    maxPerSession: 3,
    visibleMaxCumulative: 6,
    visibleMaxPerSession: 3,
    ...overrides,
  };
}

function createMockState(overrides: Record<string, any> = {}) {
  const dropTimeline = overrides.dropTimeline ?? [
    {
      sessionStartedAt: "2024-01-15T10:00:00Z",
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Affliction",
      sessionId: "s1",
    },
    {
      sessionStartedAt: "2024-01-20T10:00:00Z",
      count: 2,
      cumulativeCount: 5,
      totalDecksOpened: 80,
      league: "Affliction",
      sessionId: "s2",
    },
    {
      sessionStartedAt: "2024-04-01T10:00:00Z",
      count: 1,
      cumulativeCount: 6,
      totalDecksOpened: 50,
      league: "Settlers",
      sessionId: "s3",
    },
  ];

  const base = {
    cardDetails: {
      personalAnalytics:
        overrides.personalAnalytics !== undefined
          ? overrides.personalAnalytics
          : {
              totalLifetimeDrops: 6,
              firstSessionStartedAt: "2024-01-10T00:00:00Z",
              timelineEndDate: "2024-05-01T00:00:00Z",
              leagueDateRanges: [
                {
                  name: "Affliction",
                  startDate: "2023-12-08",
                  endDate: "2024-03-25",
                },
                { name: "Settlers", startDate: "2024-03-29", endDate: null },
              ],
            },
      getDropTimeline: vi.fn(() => dropTimeline),
    },
  };

  return base;
}

function renderComponent(
  stateOverrides: Record<string, any> = {},
  hookOverrides: Record<string, any> = {},
) {
  const mockState = createMockState(stateOverrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  mockUseDropTimelineData.mockReturnValue(defaultHookReturn(hookOverrides));
  const result = renderWithProviders(<CardDetailsDropTimeline />);
  return { ...result, mockState };
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Null returns (early exits)
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropTimeline — null returns", () => {
  it("returns null when no personalAnalytics", () => {
    const { container } = renderComponent({ personalAnalytics: null });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when totalLifetimeDrops is 0", () => {
    const { container } = renderComponent({
      personalAnalytics: {
        totalLifetimeDrops: 0,
        firstSessionStartedAt: "2024-01-10T00:00:00Z",
        timelineEndDate: "2024-05-01T00:00:00Z",
        leagueDateRanges: [],
      },
    });
    expect(container.innerHTML).toBe("");
  });

  it("returns null when dropTimeline is empty", () => {
    const { container } = renderComponent({ dropTimeline: [] });
    expect(container.innerHTML).toBe("");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Single data point — simplified view
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropTimeline — single data point", () => {
  const singleTimeline = [
    {
      sessionStartedAt: "2024-01-15T10:00:00Z",
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Affliction",
      sessionId: "s1",
    },
  ];

  it("renders simplified view for single data point", () => {
    renderComponent({ dropTimeline: singleTimeline });
    expect(screen.queryByTestId("main-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("overview-chart")).not.toBeInTheDocument();
  });

  it('shows "Drop Timeline" heading', () => {
    renderComponent({ dropTimeline: singleTimeline });
    expect(screen.getByText("Drop Timeline")).toBeInTheDocument();
  });

  it("single point view shows correct date and count", () => {
    renderComponent({ dropTimeline: singleTimeline });
    // "Found 3 cards in a single session on Jan 15, 2024 (Affliction)"
    expect(
      screen.getByText(/Found 3 cards in a single session/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Affliction/)).toBeInTheDocument();
  });

  it("single point view uses singular 'card' when count is 1", () => {
    const singleOneCard = [
      {
        sessionStartedAt: "2024-01-15T10:00:00Z",
        count: 1,
        cumulativeCount: 1,
        totalDecksOpened: 100,
        league: "Affliction",
        sessionId: "s1",
      },
    ];
    renderComponent({
      dropTimeline: singleOneCard,
      personalAnalytics: {
        totalLifetimeDrops: 1,
        firstSessionStartedAt: "2024-01-10T00:00:00Z",
        timelineEndDate: "2024-05-01T00:00:00Z",
        leagueDateRanges: [],
      },
    });
    expect(
      screen.getByText(/Found 1 card in a single session/),
    ).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Multi data point — charts
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropTimeline — multi data point", () => {
  it("renders main chart for multiple data points", () => {
    renderComponent();
    expect(screen.getByTestId("main-chart")).toBeInTheDocument();
  });

  it('shows "Drop Timeline" heading', () => {
    renderComponent();
    expect(screen.getByText("Drop Timeline")).toBeInTheDocument();
  });

  it("renders overview chart (brush) when >2 data points", () => {
    renderComponent();
    expect(screen.getByTestId("overview-chart")).toBeInTheDocument();
  });

  it("does not render overview chart when <=2 data points", () => {
    renderComponent(
      {},
      {
        chartData: [
          {
            time: 1705312800000,
            count: 3,
            cumulativeCount: 3,
            league: "Affliction",
            sessionStartedAt: "2024-01-15T10:00:00Z",
            sessionId: "s1",
            sessionCount: 1,
            totalDecksOpened: 100,
          },
          {
            time: 1705744800000,
            count: 2,
            cumulativeCount: 5,
            league: "Affliction",
            sessionStartedAt: "2024-01-20T10:00:00Z",
            sessionId: "s2",
            sessionCount: 1,
            totalDecksOpened: 80,
          },
        ],
        visibleData: [
          {
            time: 1705312800000,
            count: 3,
            cumulativeCount: 3,
            league: "Affliction",
            sessionStartedAt: "2024-01-15T10:00:00Z",
            sessionId: "s1",
            sessionCount: 1,
            totalDecksOpened: 100,
          },
          {
            time: 1705744800000,
            count: 2,
            cumulativeCount: 5,
            league: "Affliction",
            sessionStartedAt: "2024-01-20T10:00:00Z",
            sessionId: "s2",
            sessionCount: 1,
            totalDecksOpened: 80,
          },
        ],
      },
    );
    expect(screen.queryByTestId("overview-chart")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap indicators
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropTimeline — gap indicators", () => {
  it("shows gap indicator when gapIndices has items", () => {
    renderComponent({}, { gapIndices: [1] });
    expect(screen.getByText(/Timeline compressed/)).toBeInTheDocument();
  });

  it("does not show gap indicator when no gaps", () => {
    renderComponent({}, { gapIndices: [] });
    expect(screen.queryByText(/Timeline compressed/)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Footer stats
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropTimeline — footer stats", () => {
  it("shows footer stats with day count and league count", () => {
    renderComponent();
    // 3 chart data points, none are gap/boundary → "3 days across 2 leagues"
    expect(screen.getByText(/3 days across 2 leagues/)).toBeInTheDocument();
  });

  it("shows total drops in footer", () => {
    renderComponent();
    expect(screen.getByText(/6 total drops/)).toBeInTheDocument();
  });

  it('shows singular "day" when 1 day', () => {
    renderComponent(
      {},
      {
        chartData: [
          {
            time: 1705312800000,
            count: 3,
            cumulativeCount: 3,
            league: "Affliction",
            sessionStartedAt: "2024-01-15T10:00:00Z",
            sessionId: "s1",
            sessionCount: 1,
            totalDecksOpened: 100,
          },
          // Add a boundary point that should be excluded from count
          {
            time: 1705000000000,
            count: 0,
            cumulativeCount: 0,
            league: "Affliction",
            sessionStartedAt: "2024-01-12T00:00:00Z",
            sessionId: "",
            sessionCount: 0,
            isBoundary: true,
            totalDecksOpened: 0,
          },
          // Add a gap point that should be excluded from count
          {
            time: 1705200000000,
            count: 0,
            cumulativeCount: 0,
            league: "",
            sessionStartedAt: "",
            sessionId: "",
            sessionCount: 0,
            isGap: true,
            totalDecksOpened: 0,
          },
        ],
        uniqueLeagues: ["Affliction"],
        visibleData: [
          {
            time: 1705312800000,
            count: 3,
            cumulativeCount: 3,
            league: "Affliction",
            sessionStartedAt: "2024-01-15T10:00:00Z",
            sessionId: "s1",
            sessionCount: 1,
            totalDecksOpened: 100,
          },
        ],
      },
    );
    expect(screen.getByText(/1 day across 1 league/)).toBeInTheDocument();
  });

  it('shows singular "league" when 1 league', () => {
    renderComponent(
      {},
      {
        chartData: [
          {
            time: 1705312800000,
            count: 3,
            cumulativeCount: 3,
            league: "Affliction",
            sessionStartedAt: "2024-01-15T10:00:00Z",
            sessionId: "s1",
            sessionCount: 1,
            totalDecksOpened: 100,
          },
          {
            time: 1705744800000,
            count: 2,
            cumulativeCount: 5,
            league: "Affliction",
            sessionStartedAt: "2024-01-20T10:00:00Z",
            sessionId: "s2",
            sessionCount: 1,
            totalDecksOpened: 80,
          },
          {
            time: 1706000000000,
            count: 1,
            cumulativeCount: 6,
            league: "Affliction",
            sessionStartedAt: "2024-01-23T10:00:00Z",
            sessionId: "s3",
            sessionCount: 1,
            totalDecksOpened: 50,
          },
        ],
        uniqueLeagues: ["Affliction"],
        visibleData: [
          {
            time: 1705312800000,
            count: 3,
            cumulativeCount: 3,
            league: "Affliction",
            sessionStartedAt: "2024-01-15T10:00:00Z",
            sessionId: "s1",
            sessionCount: 1,
            totalDecksOpened: 100,
          },
          {
            time: 1705744800000,
            count: 2,
            cumulativeCount: 5,
            league: "Affliction",
            sessionStartedAt: "2024-01-20T10:00:00Z",
            sessionId: "s2",
            sessionCount: 1,
            totalDecksOpened: 80,
          },
          {
            time: 1706000000000,
            count: 1,
            cumulativeCount: 6,
            league: "Affliction",
            sessionStartedAt: "2024-01-23T10:00:00Z",
            sessionId: "s3",
            sessionCount: 1,
            totalDecksOpened: 50,
          },
        ],
      },
    );
    expect(screen.getByText(/3 days across 1 league$/)).toBeInTheDocument();
  });

  it('shows singular "drop" when totalLifetimeDrops is 1', () => {
    renderComponent({
      personalAnalytics: {
        totalLifetimeDrops: 1,
        firstSessionStartedAt: "2024-01-10T00:00:00Z",
        timelineEndDate: "2024-05-01T00:00:00Z",
        leagueDateRanges: [],
      },
    });
    expect(screen.getByText(/1 total drop$/)).toBeInTheDocument();
  });
});
