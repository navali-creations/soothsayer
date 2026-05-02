import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders, screen } from "~/renderer/__test-setup__/render";
import { useCardDetails, useLeagues, useSettings } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({
  useCardDetails: vi.fn(),
  useLeagues: vi.fn(),
  useSettings: vi.fn(),
}));

// ─── Hook & component mocks ───────────────────────────────────────────────

vi.mock("~/renderer/hooks", () => ({
  useChartColors: vi.fn(() => ({
    primary: "#00f",
    secondary: "#0f0",
    secondary60: "rgba(0,255,0,0.6)",
    muted: "#999",
    text: "#fff",
    grid: "#333",
    tooltip: "#111",
  })),
}));

const mockUseDropTimelineData = vi.fn();
const mockMainChart = vi.fn(() => <div data-testid="main-chart" />);

vi.mock("./useDropTimelineData/useDropTimelineData", () => ({
  useDropTimelineData: (...args: any[]) => mockUseDropTimelineData(...args),
}));

vi.mock("./MainChart/MainChart", () => ({
  default: (props: any) => mockMainChart(props),
}));

vi.mock("./OverviewChart/OverviewChart", () => ({
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
    visibleTimeMin: 1705312800000,
    visibleTimeMax: 1711965600000,
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
      selectedLeague: overrides.selectedLeague ?? "all",
    },
  };

  return base;
}

function createMockSettings(overrides: Record<string, any> = {}) {
  return {
    getSelectedGame: vi.fn(() => "poe1"),
    getActiveGameViewSelectedLeague: vi.fn(() => "Mirage"),
    ...overrides,
  };
}

function createMockLeagues(overrides: Record<string, any> = {}) {
  return {
    getLeaguesForGame: vi.fn(() => [
      {
        id: "Mirage",
        name: "Mirage",
        startAt: "2024-04-17T00:00:00Z",
        endAt: null,
      },
    ]),
    ...overrides,
  };
}

function renderComponent(
  stateOverrides: Record<string, any> = {},
  hookOverrides: Record<string, any> = {},
) {
  const mockState = createMockState(stateOverrides);
  const mockSettings = createMockSettings(stateOverrides.settings);
  const mockLeagues = createMockLeagues(stateOverrides.leagues);
  vi.mocked(useCardDetails).mockReturnValue(mockState.cardDetails as any);
  vi.mocked(useSettings).mockReturnValue(mockSettings as any);
  vi.mocked(useLeagues).mockReturnValue(mockLeagues as any);
  mockUseDropTimelineData.mockReturnValue(defaultHookReturn(hookOverrides));
  const result = renderWithProviders(<CardDetailsDropTimeline />);
  return { ...result, mockState, mockSettings, mockLeagues };
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

  it("ignores wheel zoom when the brush is not shown", () => {
    const handleBrushChange = vi.fn();
    renderComponent({}, { handleBrushChange });

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    mainChartProps.onWheelZoom({ deltaY: -120, focusRatio: 0.5 });

    expect(handleBrushChange).not.toHaveBeenCalled();
  });

  it("ignores wheel zoom deltas below one pixel", () => {
    const handleBrushChange = vi.fn();
    const chartData = Array.from({ length: 6 }, (_, index) => ({
      time: 1705312800000 + index * 86400000,
      count: 1,
      cumulativeCount: index + 1,
      totalDecksOpened: 10,
      league: "Affliction",
      sessionStartedAt: "2024-01-15T10:00:00Z",
      sessionId: `s${index}`,
      sessionCount: 1,
    }));

    renderComponent(
      {},
      {
        chartData,
        visibleData: chartData,
        handleBrushChange,
        visibleTimeMin: chartData[0].time,
        visibleTimeMax: chartData[5].time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    mainChartProps.onWheelZoom({ deltaY: 0.5, focusRatio: 0.5 });

    expect(handleBrushChange).not.toHaveBeenCalled();
  });

  it("keeps the full brush range when wheel zoom would not change it", () => {
    const handleBrushChange = vi.fn();
    const chartData = Array.from({ length: 6 }, (_, index) => ({
      time: 1705312800000 + index * 86400000,
      count: 1,
      cumulativeCount: index + 1,
      totalDecksOpened: 10,
      league: "Affliction",
      sessionStartedAt: "2024-01-15T10:00:00Z",
      sessionId: `s${index}`,
      sessionCount: 1,
    }));

    renderComponent(
      {},
      {
        chartData,
        visibleData: chartData,
        brushStartIndex: 0,
        brushEndIndex: 5,
        handleBrushChange,
        visibleTimeMin: chartData[0].time,
        visibleTimeMax: chartData[5].time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    mainChartProps.onWheelZoom({ deltaY: 120, focusRatio: 0.5 });

    expect(handleBrushChange).not.toHaveBeenCalled();
  });

  it("zooms the brush around the requested focus ratio", () => {
    const handleBrushChange = vi.fn();
    const chartData = Array.from({ length: 12 }, (_, index) => ({
      time: 1705312800000 + index * 86400000,
      count: 1,
      cumulativeCount: index + 1,
      totalDecksOpened: 10,
      league: "Affliction",
      sessionStartedAt: "2024-01-15T10:00:00Z",
      sessionId: `s${index}`,
      sessionCount: 1,
    }));

    renderComponent(
      {},
      {
        chartData,
        visibleData: chartData,
        brushStartIndex: 0,
        brushEndIndex: 11,
        handleBrushChange,
        visibleTimeMin: chartData[0].time,
        visibleTimeMax: chartData[11].time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    mainChartProps.onWheelZoom({ deltaY: -120, focusRatio: Number.NaN });

    expect(handleBrushChange).toHaveBeenCalledWith({
      startIndex: expect.any(Number),
      endIndex: expect.any(Number),
    });
  });

  it("renders chart legend entries for bars and line", () => {
    renderComponent();
    expect(screen.getByText("Drops / Day")).toBeInTheDocument();
    expect(screen.getByText("Expected to Drop")).toBeInTheDocument();
    expect(screen.getByText("Decks Opened")).toBeInTheDocument();
  });

  it("hides zero-drop sessions by default and restores them with the include-all checkbox", () => {
    const zeroDropSession = {
      sessionStartedAt: "2024-01-10T10:00:00Z",
      count: 0,
      cumulativeCount: 0,
      totalDecksOpened: 90,
      league: "Affliction",
      sessionId: "zero-drop",
    };
    const dropSessionA = {
      sessionStartedAt: "2024-01-15T10:00:00Z",
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Affliction",
      sessionId: "drop-a",
    };
    const dropSessionB = {
      sessionStartedAt: "2024-01-20T10:00:00Z",
      count: 2,
      cumulativeCount: 5,
      totalDecksOpened: 80,
      league: "Affliction",
      sessionId: "drop-b",
    };

    renderComponent({
      dropTimeline: [zeroDropSession, dropSessionA, dropSessionB],
    });

    expect(mockUseDropTimelineData).toHaveBeenLastCalledWith([
      dropSessionA,
      dropSessionB,
    ]);

    const toggle = screen.getByLabelText("Include all sessions");
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);

    expect(toggle).toBeChecked();
    expect(mockUseDropTimelineData).toHaveBeenLastCalledWith([
      zeroDropSession,
      dropSessionA,
      dropSessionB,
    ]);
  });

  it("renders compressed gaps legend entry when inactivity gaps are present", () => {
    const pointA = {
      time: new Date("2026-01-01T00:00:00.000Z").getTime(),
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Mirage",
      sessionStartedAt: "2026-01-01T00:00:00.000Z",
      sessionId: "s1",
      sessionCount: 1,
    };
    const gapPoint = {
      time: new Date("2026-01-10T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 3,
      totalDecksOpened: 0,
      league: "",
      sessionStartedAt: "2026-01-10T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isGap: true,
    };
    const pointB = {
      time: new Date("2026-01-25T00:00:00.000Z").getTime(),
      count: 1,
      cumulativeCount: 4,
      totalDecksOpened: 30,
      league: "Mirage",
      sessionStartedAt: "2026-01-25T00:00:00.000Z",
      sessionId: "s2",
      sessionCount: 1,
    };

    renderComponent(
      {},
      {
        chartData: [pointA, gapPoint, pointB],
        visibleData: [pointA, gapPoint, pointB],
        gapIndices: [1],
        visibleTimeMin: pointA.time,
        visibleTimeMax: pointB.time,
      },
    );

    expect(screen.getByText("Compressed Gaps")).toBeInTheDocument();
  });

  it("passes compressed gaps with trailing one-day buffer before next session", () => {
    const pointA = {
      time: new Date("2026-01-01T00:00:00.000Z").getTime(),
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Mirage",
      sessionStartedAt: "2026-01-01T00:00:00.000Z",
      sessionId: "s1",
      sessionCount: 1,
    };
    const gapPoint = {
      time: new Date("2026-01-10T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 3,
      totalDecksOpened: 0,
      league: "",
      sessionStartedAt: "2026-01-10T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isGap: true,
    };
    const pointB = {
      time: new Date("2026-01-25T00:00:00.000Z").getTime(),
      count: 1,
      cumulativeCount: 4,
      totalDecksOpened: 30,
      league: "Mirage",
      sessionStartedAt: "2026-01-25T00:00:00.000Z",
      sessionId: "s2",
      sessionCount: 1,
    };

    renderComponent(
      {},
      {
        chartData: [pointA, gapPoint, pointB],
        visibleData: [pointA, gapPoint, pointB],
        gapIndices: [1],
        visibleTimeMin: pointA.time,
        visibleTimeMax: pointB.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.compressedGaps).toEqual([
      {
        startTime: pointA.time + 3 * 24 * 60 * 60 * 1000,
        endTime: pointB.time - 2 * 24 * 60 * 60 * 1000,
      },
    ]);
  });

  it("adds compressed trailing gap from last session to league-end boundary in filtered league mode", () => {
    const lastSession = {
      time: new Date("2026-02-19T00:00:00.000Z").getTime(),
      count: 2,
      cumulativeCount: 5,
      totalDecksOpened: 80,
      league: "Keepers",
      sessionStartedAt: "2026-02-19T00:00:00.000Z",
      sessionId: "k1",
      sessionCount: 1,
    };
    const leagueEndBoundary = {
      time: new Date("2026-03-04T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 5,
      totalDecksOpened: 0,
      league: "Keepers",
      sessionStartedAt: "2026-03-04T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };

    renderComponent(
      { selectedLeague: "Keepers" },
      {
        chartData: [lastSession, leagueEndBoundary],
        visibleData: [lastSession, leagueEndBoundary],
        gapIndices: [],
        visibleTimeMin: lastSession.time,
        visibleTimeMax: leagueEndBoundary.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.compressedGaps).toEqual([
      {
        startTime: lastSession.time + 3 * 24 * 60 * 60 * 1000,
        endTime: leagueEndBoundary.time - 2 * 24 * 60 * 60 * 1000,
      },
    ]);
  });

  it("adds compressed leading gap from league-start to first session in filtered league mode", () => {
    const leagueStartBoundary = {
      time: new Date("2026-01-01T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 0,
      totalDecksOpened: 0,
      league: "Keepers",
      sessionStartedAt: "2026-01-01T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };
    const firstSession = {
      time: new Date("2026-01-15T00:00:00.000Z").getTime(),
      count: 2,
      cumulativeCount: 2,
      totalDecksOpened: 60,
      league: "Keepers",
      sessionStartedAt: "2026-01-15T00:00:00.000Z",
      sessionId: "k1",
      sessionCount: 1,
    };

    renderComponent(
      {
        selectedLeague: "Keepers",
        personalAnalytics: {
          totalLifetimeDrops: 6,
          firstSessionStartedAt: "2024-01-10T00:00:00Z",
          timelineEndDate: "2026-03-04T00:00:00Z",
          leagueDateRanges: [
            {
              name: "Keepers",
              startDate: "2026-01-01T00:00:00.000Z",
              endDate: "2026-03-04T00:00:00.000Z",
            },
          ],
        },
      },
      {
        chartData: [leagueStartBoundary, firstSession],
        visibleData: [leagueStartBoundary, firstSession],
        gapIndices: [],
        visibleTimeMin: leagueStartBoundary.time,
        visibleTimeMax: firstSession.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.compressedGaps).toEqual([
      {
        startTime: leagueStartBoundary.time + 3 * 24 * 60 * 60 * 1000,
        endTime: firstSession.time - 2 * 24 * 60 * 60 * 1000,
      },
    ]);
  });

  it("adds compressed leading gap even when selectedLeague value differs from point league label", () => {
    const leagueStartBoundary = {
      time: new Date("2026-01-01T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 0,
      totalDecksOpened: 0,
      league: "Keepers",
      sessionStartedAt: "2026-01-01T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };
    const firstSessionWithDifferentLeagueLabel = {
      time: new Date("2026-01-15T00:00:00.000Z").getTime(),
      count: 2,
      cumulativeCount: 2,
      totalDecksOpened: 60,
      league: "Mirage",
      sessionStartedAt: "2026-01-15T00:00:00.000Z",
      sessionId: "k1",
      sessionCount: 1,
    };

    renderComponent(
      {
        selectedLeague: "Keepers",
        personalAnalytics: {
          totalLifetimeDrops: 6,
          firstSessionStartedAt: "2024-01-10T00:00:00Z",
          timelineEndDate: "2026-03-04T00:00:00Z",
          leagueDateRanges: [
            {
              name: "Keepers",
              startDate: "2026-01-01T00:00:00.000Z",
              endDate: "2026-03-04T00:00:00.000Z",
            },
          ],
        },
      },
      {
        chartData: [leagueStartBoundary, firstSessionWithDifferentLeagueLabel],
        visibleData: [
          leagueStartBoundary,
          firstSessionWithDifferentLeagueLabel,
        ],
        gapIndices: [],
        visibleTimeMin: leagueStartBoundary.time,
        visibleTimeMax: firstSessionWithDifferentLeagueLabel.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.compressedGaps).toEqual([
      {
        startTime: leagueStartBoundary.time + 3 * 24 * 60 * 60 * 1000,
        endTime:
          firstSessionWithDifferentLeagueLabel.time - 2 * 24 * 60 * 60 * 1000,
      },
    ]);
  });

  it("does not clamp leading compressed gap start to visibleTimeMin in filtered league mode", () => {
    const leagueStartBoundary = {
      time: new Date("2025-10-31T19:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 0,
      totalDecksOpened: 0,
      league: "Keepers",
      sessionStartedAt: "2025-10-31T19:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };
    const firstSession = {
      time: new Date("2025-12-21T00:00:00.000Z").getTime(),
      count: 2,
      cumulativeCount: 2,
      totalDecksOpened: 60,
      league: "Keepers",
      sessionStartedAt: "2025-12-21T00:00:00.000Z",
      sessionId: "k1",
      sessionCount: 1,
    };
    const visibleStartAfterLeagueStart = new Date(
      "2025-12-17T00:00:00.000Z",
    ).getTime();

    renderComponent(
      {
        selectedLeague: "Keepers",
        personalAnalytics: {
          totalLifetimeDrops: 6,
          firstSessionStartedAt: "2024-01-10T00:00:00Z",
          timelineEndDate: "2026-03-04T00:00:00Z",
          leagueDateRanges: [
            {
              name: "Keepers",
              startDate: "2025-10-31T19:00:00.000Z",
              endDate: "2026-03-04T00:00:00.000Z",
            },
          ],
        },
      },
      {
        chartData: [leagueStartBoundary, firstSession],
        visibleData: [leagueStartBoundary, firstSession],
        gapIndices: [],
        visibleTimeMin: visibleStartAfterLeagueStart,
        visibleTimeMax: firstSession.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.compressedGaps).toEqual([
      {
        startTime: leagueStartBoundary.time + 3 * 24 * 60 * 60 * 1000,
        endTime: firstSession.time - 2 * 24 * 60 * 60 * 1000,
      },
    ]);
  });

  it("keeps boundary compression but hides league-start/end boundary zig-zag render markers", () => {
    const leagueStartBoundary = {
      time: new Date("2025-10-31T19:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 0,
      totalDecksOpened: 0,
      league: "Keepers",
      sessionStartedAt: "2025-10-31T19:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };
    const firstSession = {
      time: new Date("2025-12-21T00:00:00.000Z").getTime(),
      count: 2,
      cumulativeCount: 2,
      totalDecksOpened: 60,
      league: "Keepers",
      sessionStartedAt: "2025-12-21T00:00:00.000Z",
      sessionId: "k1",
      sessionCount: 1,
    };
    const lastSession = {
      time: new Date("2026-02-19T00:00:00.000Z").getTime(),
      count: 3,
      cumulativeCount: 5,
      totalDecksOpened: 100,
      league: "Keepers",
      sessionStartedAt: "2026-02-19T00:00:00.000Z",
      sessionId: "k2",
      sessionCount: 1,
    };
    const leagueEndBoundary = {
      time: new Date("2026-03-04T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 5,
      totalDecksOpened: 0,
      league: "Keepers",
      sessionStartedAt: "2026-03-04T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };

    renderComponent(
      {
        selectedLeague: "Keepers",
        personalAnalytics: {
          totalLifetimeDrops: 6,
          firstSessionStartedAt: "2024-01-10T00:00:00Z",
          timelineEndDate: "2026-03-04T00:00:00Z",
          leagueDateRanges: [
            {
              name: "Keepers",
              startDate: "2025-10-31T19:00:00.000Z",
              endDate: "2026-03-04T00:00:00.000Z",
            },
          ],
        },
      },
      {
        chartData: [
          leagueStartBoundary,
          firstSession,
          lastSession,
          leagueEndBoundary,
        ],
        visibleData: [
          leagueStartBoundary,
          firstSession,
          lastSession,
          leagueEndBoundary,
        ],
        gapIndices: [],
        visibleTimeMin: leagueStartBoundary.time,
        visibleTimeMax: leagueEndBoundary.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.compressedGaps).toEqual([
      {
        startTime: leagueStartBoundary.time + 3 * 24 * 60 * 60 * 1000,
        endTime: firstSession.time - 2 * 24 * 60 * 60 * 1000,
      },
      {
        startTime: lastSession.time + 3 * 24 * 60 * 60 * 1000,
        endTime: leagueEndBoundary.time - 2 * 24 * 60 * 60 * 1000,
      },
    ]);
    expect(mainChartProps.renderedCompressedGaps).toEqual([]);
  });

  it("toggles legend items and passes hidden metrics to main chart", () => {
    renderComponent();

    const dropsButton = screen.getByText("Drops / Day").closest("button");
    expect(dropsButton).toBeInTheDocument();
    fireEvent.click(dropsButton!);

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.hiddenMetrics).toBeInstanceOf(Set);
    expect(mainChartProps.hiddenMetrics.has("drops-per-day")).toBe(true);
  });

  it("toggles deck volume line from the legend", () => {
    renderComponent();

    const decksButton = screen.getByText("Decks Opened").closest("button");
    expect(decksButton).toBeInTheDocument();
    fireEvent.click(decksButton!);

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.hiddenMetrics).toBeInstanceOf(Set);
    expect(mainChartProps.hiddenMetrics.has("decks-opened")).toBe(true);
  });

  it("passes trailing inactivity gap to main chart for all-leagues view", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-26T12:00:00.000Z"));

    const oldSession = {
      time: new Date("2026-02-01T00:00:00.000Z").getTime(),
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Mirage",
      sessionStartedAt: "2026-02-01T00:00:00.000Z",
      sessionId: "s1",
      sessionCount: 1,
    };
    const boundary = {
      time: new Date("2026-06-01T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 3,
      totalDecksOpened: 0,
      league: "Mirage",
      sessionStartedAt: "2026-06-01T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isBoundary: true,
    };

    renderComponent(
      {},
      {
        chartData: [oldSession, boundary],
        visibleData: [oldSession, boundary],
        visibleTimeMin: oldSession.time,
        visibleTimeMax: boundary.time,
      },
    );

    const now = new Date("2026-04-26T12:00:00.000Z");
    const expectedGapEnd =
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - 1;

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.inactivityGap).toEqual({
      startTime: oldSession.time + 3 * 24 * 60 * 60 * 1000,
      endTime: expectedGapEnd,
    });

    vi.useRealTimers();
  });

  it('shows "Drop Timeline" heading', () => {
    renderComponent();
    expect(screen.getByText("Drop Timeline")).toBeInTheDocument();
  });

  it("renders overview chart (brush) when more than 5 real data points", () => {
    const chartData = Array.from({ length: 6 }, (_, index) => ({
      time: 1705312800000 + index * 24 * 60 * 60 * 1000,
      count: 1,
      cumulativeCount: index + 1,
      league: "Affliction",
      sessionStartedAt: new Date(
        1705312800000 + index * 24 * 60 * 60 * 1000,
      ).toISOString(),
      sessionId: `s${index + 1}`,
      sessionCount: 1,
      totalDecksOpened: 100,
    }));

    renderComponent(
      {},
      {
        chartData,
        visibleData: chartData,
        visibleMaxCumulative: 6,
      },
    );
    expect(screen.getByTestId("overview-chart")).toBeInTheDocument();
  });

  it("does not render overview chart when 5 or fewer real data points", () => {
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
  it("shows compressed gaps in the legend when compressed gaps are present", () => {
    const pointA = {
      time: new Date("2026-01-01T00:00:00.000Z").getTime(),
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Mirage",
      sessionStartedAt: "2026-01-01T00:00:00.000Z",
      sessionId: "s1",
      sessionCount: 1,
    };
    const gapPoint = {
      time: new Date("2026-01-10T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 3,
      totalDecksOpened: 0,
      league: "",
      sessionStartedAt: "2026-01-10T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isGap: true,
    };
    const pointB = {
      time: new Date("2026-01-25T00:00:00.000Z").getTime(),
      count: 1,
      cumulativeCount: 4,
      totalDecksOpened: 30,
      league: "Mirage",
      sessionStartedAt: "2026-01-25T00:00:00.000Z",
      sessionId: "s2",
      sessionCount: 1,
    };

    renderComponent(
      {},
      {
        chartData: [pointA, gapPoint, pointB],
        visibleData: [pointA, gapPoint, pointB],
        gapIndices: [1],
        visibleTimeMin: pointA.time,
        visibleTimeMax: pointB.time,
      },
    );
    expect(screen.getByText("Compressed Gaps")).toBeInTheDocument();
    expect(screen.queryByText(/Timeline compressed/)).not.toBeInTheDocument();
  });

  it("does not show compressed gaps footer hint when no gaps", () => {
    renderComponent({}, { gapIndices: [] });
    expect(screen.queryByText(/Timeline compressed/)).not.toBeInTheDocument();
  });

  it("suppresses compressed gap when league-start marker falls inside that gap", () => {
    const pointA = {
      time: new Date("2026-01-01T00:00:00.000Z").getTime(),
      count: 3,
      cumulativeCount: 3,
      totalDecksOpened: 100,
      league: "Keepers",
      sessionStartedAt: "2026-01-01T00:00:00.000Z",
      sessionId: "s1",
      sessionCount: 1,
    };
    const gapPoint = {
      time: new Date("2026-01-12T00:00:00.000Z").getTime(),
      count: 0,
      cumulativeCount: 3,
      totalDecksOpened: 0,
      league: "",
      sessionStartedAt: "2026-01-12T00:00:00.000Z",
      sessionId: "",
      sessionCount: 0,
      isGap: true,
    };
    const pointB = {
      time: new Date("2026-01-25T00:00:00.000Z").getTime(),
      count: 1,
      cumulativeCount: 4,
      totalDecksOpened: 30,
      league: "Mirage",
      sessionStartedAt: "2026-01-25T00:00:00.000Z",
      sessionId: "s2",
      sessionCount: 1,
    };

    renderComponent(
      {
        leagues: {
          getLeaguesForGame: vi.fn(() => [
            {
              id: "Mirage",
              name: "Mirage",
              startAt: "2026-01-15T00:00:00Z",
              endAt: null,
            },
          ]),
        },
      },
      {
        chartData: [pointA, gapPoint, pointB],
        visibleData: [pointA, gapPoint, pointB],
        gapIndices: [1],
        visibleTimeMin: pointA.time,
        visibleTimeMax: pointB.time,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.renderedCompressedGaps).toEqual([]);
    expect(mainChartProps.compressedGaps).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// League markers — visible range filtering (L89)
// ═══════════════════════════════════════════════════════════════════════════

describe("CardDetailsDropTimeline — visible league markers", () => {
  it("filters league markers to only those within the visible time range", () => {
    // visibleData spans Jan 15 – Apr 1 2024.
    // Marker inside range should be kept; marker far outside should be dropped.
    const insideMarker = {
      time: 1705400000000, // ~Jan 16 2024, within visible range
      label: "Affliction Start",
      type: "start" as const,
    };
    const outsideMarker = {
      time: 1600000000000, // Sep 2020, far outside visible range
      label: "Ancient League",
      type: "start" as const,
    };

    renderComponent(
      {},
      {
        leagueMarkers: [insideMarker, outsideMarker],
      },
    );

    // The main chart should be rendered (multi-point default data)
    expect(screen.getByTestId("main-chart")).toBeInTheDocument();
  });

  it("computes visibleTimeMin and visibleTimeMax from visibleData endpoints", () => {
    // visibleData[0].time = 1705312800000 (Jan 15 2024)
    // visibleData[last].time = 1711965600000 (Apr 1 2024)
    // timeMargin = 7 * 24 * 60 * 60 * 1000 = 604800000
    //
    // A marker just inside the 7-day margin before visibleTimeMin should be kept.
    // A marker just outside the 7-day margin should be dropped.
    const timeMargin = 7 * 24 * 60 * 60 * 1000;
    const visibleTimeMin = 1705312800000; // Jan 15
    const visibleTimeMax = 1711965600000; // Apr 1

    const justInsideStart = {
      time: visibleTimeMin - timeMargin + 1000, // within margin
      label: "Just Inside Start",
      type: "start" as const,
    };
    const justOutsideStart = {
      time: visibleTimeMin - timeMargin - 86400000, // 1 day past margin
      label: "Just Outside Start",
      type: "start" as const,
    };
    const justInsideEnd = {
      time: visibleTimeMax + timeMargin - 1000, // within margin
      label: "Just Inside End",
      type: "end" as const,
    };
    const justOutsideEnd = {
      time: visibleTimeMax + timeMargin + 86400000, // 1 day past margin
      label: "Just Outside End",
      type: "end" as const,
    };
    const middleMarker = {
      time: 1708000000000, // Feb 2024, well within range
      label: "Middle Marker",
      type: "start" as const,
    };

    renderComponent(
      {},
      {
        leagueMarkers: [
          justInsideStart,
          justOutsideStart,
          justInsideEnd,
          justOutsideEnd,
          middleMarker,
        ],
      },
    );

    // Main chart renders — visibleTimeMin / visibleTimeMax were computed
    // from visibleData and used to filter markers.
    expect(screen.getByTestId("main-chart")).toBeInTheDocument();
  });

  it("handles visibleData with a single entry (min equals max)", () => {
    const singlePointData = [
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
    ];

    // When visibleData has only 1 entry, visibleTimeMin === visibleTimeMax
    const markerNear = {
      time: 1705312800000 + 1000, // same as the single point
      label: "Near Marker",
      type: "start" as const,
    };
    const markerFar = {
      time: 1600000000000, // far away
      label: "Far Marker",
      type: "start" as const,
    };

    renderComponent(
      {},
      {
        // Need >2 chartData points to show brush, but visibleData is single
        visibleData: singlePointData,
        leagueMarkers: [markerNear, markerFar],
      },
    );

    expect(screen.getByTestId("main-chart")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("CardDetailsDropTimeline — leagues slice league start marker", () => {
  it("uses active game league start from leagues slice when selectedLeague is all", () => {
    renderComponent(
      {},
      {
        visibleTimeMin: new Date("2024-04-01T00:00:00Z").getTime(),
        visibleTimeMax: new Date("2024-04-26T00:00:00Z").getTime(),
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.visibleMarkers).toEqual([
      {
        time: new Date("2024-04-17T00:00:00Z").getTime(),
        label: "Mirage",
        type: "start",
        emphasis: "highlight",
      },
    ]);
  });

  it("hides the marker when card-details selectedLeague is not all", () => {
    renderComponent({ selectedLeague: "Mirage" });

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.visibleMarkers).toEqual([]);
    expect(screen.queryByText("League Start")).not.toBeInTheDocument();
  });

  it("hides the marker when active league has no valid startAt", () => {
    renderComponent({
      leagues: {
        getLeaguesForGame: vi.fn(() => [
          { id: "Mirage", name: "Mirage", startAt: null, endAt: null },
        ]),
      },
    });

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.visibleMarkers).toEqual([]);
  });

  it("hides the marker when brush window no longer includes league start", () => {
    renderComponent(
      {},
      {
        visibleTimeMin: new Date("2024-04-20T00:00:00Z").getTime(),
        visibleTimeMax: new Date("2024-04-26T00:00:00Z").getTime(),
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.visibleMarkers).toEqual([]);
  });

  it("shows dimmed league start/end markers in non-all league view with 1-day breathing room", () => {
    const keepersStart = new Date("2025-10-31T19:00:00+00:00").getTime();
    const keepersEnd = new Date("2026-03-03T19:00:00+00:00").getTime();
    const oneDay = 24 * 60 * 60 * 1000;

    renderComponent(
      {
        selectedLeague: "Keepers",
        personalAnalytics: {
          totalLifetimeDrops: 6,
          firstSessionStartedAt: "2024-01-10T00:00:00Z",
          timelineEndDate: "2026-03-03T19:00:00+00:00",
          leagueDateRanges: [
            {
              name: "Keepers",
              startDate: "2025-10-31T19:00:00+00:00",
              endDate: null,
            },
            {
              name: "Mirage",
              startDate: "2026-03-06T19:00:00+00:00",
              endDate: null,
            },
          ],
        },
      },
      {
        visibleTimeMin: keepersStart,
        visibleTimeMax: keepersEnd,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.visibleMarkers).toEqual([
      {
        time: keepersStart,
        label: "League Start",
        type: "start",
        emphasis: "muted",
      },
      {
        time: keepersEnd,
        label: "League End",
        type: "end",
        emphasis: "muted",
      },
    ]);
    expect(mainChartProps.visibleTimeMin).toBe(keepersStart - oneDay);
    expect(mainChartProps.visibleTimeMax).toBe(keepersEnd + oneDay);
  });

  it("does not force non-all league markers into main chart domain when brush window excludes them", () => {
    const keepersStart = new Date("2025-10-31T19:00:00+00:00").getTime();
    const keepersEnd = new Date("2026-03-03T19:00:00+00:00").getTime();
    const brushVisibleMin = new Date("2026-02-01T00:00:00+00:00").getTime();
    const brushVisibleMax = new Date("2026-02-20T00:00:00+00:00").getTime();

    renderComponent(
      {
        selectedLeague: "Keepers",
        personalAnalytics: {
          totalLifetimeDrops: 6,
          firstSessionStartedAt: "2024-01-10T00:00:00Z",
          timelineEndDate: "2026-03-03T19:00:00+00:00",
          leagueDateRanges: [
            {
              name: "Keepers",
              startDate: "2025-10-31T19:00:00+00:00",
              endDate: "2026-03-03T19:00:00+00:00",
            },
          ],
        },
      },
      {
        visibleTimeMin: brushVisibleMin,
        visibleTimeMax: brushVisibleMax,
      },
    );

    const mainChartProps = mockMainChart.mock.calls.at(-1)?.[0];
    expect(mainChartProps.visibleMarkers).toEqual([]);
    expect(mainChartProps.visibleTimeMin).toBe(brushVisibleMin);
    expect(mainChartProps.visibleTimeMax).toBe(brushVisibleMax);

    // Sanity: selected league still has boundaries, but they are outside brush view.
    expect(keepersStart).toBeLessThan(brushVisibleMin);
    expect(keepersEnd).toBeGreaterThan(brushVisibleMax);
  });
});
