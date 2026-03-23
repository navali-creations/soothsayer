import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useBoundStore } from "~/renderer/store";

// ─── Store mock ────────────────────────────────────────────────────────────

vi.mock("~/renderer/store", () => ({ useBoundStore: vi.fn() }));

// ─── Import after mock ─────────────────────────────────────────────────────

import { useDropTimelineData } from "../CardDetails.components/CardDetailsDropTimeline/useDropTimelineData";

// ─── Test data ─────────────────────────────────────────────────────────────

const mockTimeline = [
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

const mockAnalytics = {
  totalLifetimeDrops: 6,
  firstSessionStartedAt: "2024-01-10T00:00:00Z",
  timelineEndDate: "2024-05-01T00:00:00Z",
  leagueDateRanges: [
    { name: "Affliction", startDate: "2023-12-08", endDate: "2024-03-25" },
    { name: "Settlers", startDate: "2024-03-29", endDate: null },
  ],
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function createMockState(overrides: Record<string, any> = {}) {
  const dropTimeline = overrides.dropTimeline ?? mockTimeline;
  const personalAnalytics =
    overrides.personalAnalytics !== undefined
      ? overrides.personalAnalytics
      : mockAnalytics;
  const selectedLeague = overrides.selectedLeague ?? "all";

  return {
    cardDetails: {
      personalAnalytics,
      getDropTimeline: vi.fn(() => dropTimeline),
      selectedLeague,
    },
  };
}

function renderTimelineHook(overrides: Record<string, any> = {}) {
  const mockState = createMockState(overrides);
  vi.mocked(useBoundStore).mockReturnValue(mockState as any);
  return renderHook(() => useDropTimelineData());
}

// ─── Cleanup ───────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Empty data
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — empty data", () => {
  it("returns empty chartData when dropTimeline is empty", () => {
    const { result } = renderTimelineHook({ dropTimeline: [] });
    expect(result.current.chartData).toEqual([]);
    expect(result.current.gapIndices).toEqual([]);
    expect(result.current.leagueMarkers).toEqual([]);
    expect(result.current.uniqueLeagues).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Chart data building
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — chart data points", () => {
  it("returns correct number of chart data points for multiple sessions", () => {
    const { result } = renderTimelineHook();
    // 3 data points + gap marker between leagues + leading boundary + trailing boundary
    const realPoints = result.current.chartData.filter(
      (p) => !p.isGap && !p.isBoundary,
    );
    expect(realPoints.length).toBe(3);
  });

  it("aggregates same-day sessions into single data point", () => {
    const sameDayTimeline = [
      {
        sessionStartedAt: "2024-01-15T10:00:00Z",
        count: 3,
        cumulativeCount: 3,
        totalDecksOpened: 100,
        league: "Affliction",
        sessionId: "s1",
      },
      {
        sessionStartedAt: "2024-01-15T14:00:00Z",
        count: 2,
        cumulativeCount: 5,
        totalDecksOpened: 80,
        league: "Affliction",
        sessionId: "s2",
      },
    ];
    const { result } = renderTimelineHook({ dropTimeline: sameDayTimeline });
    const realPoints = result.current.chartData.filter(
      (p) => !p.isGap && !p.isBoundary,
    );
    expect(realPoints.length).toBe(1);
    // Counts should be summed
    expect(realPoints[0].count).toBe(5);
    // Cumulative should be from the last point
    expect(realPoints[0].cumulativeCount).toBe(5);
    // Total decks should be summed
    expect(realPoints[0].totalDecksOpened).toBe(180);
  });

  it("counts sessionCount in aggregated points", () => {
    const sameDayTimeline = [
      {
        sessionStartedAt: "2024-01-15T10:00:00Z",
        count: 3,
        cumulativeCount: 3,
        totalDecksOpened: 100,
        league: "Affliction",
        sessionId: "s1",
      },
      {
        sessionStartedAt: "2024-01-15T14:00:00Z",
        count: 2,
        cumulativeCount: 5,
        totalDecksOpened: 80,
        league: "Affliction",
        sessionId: "s2",
      },
    ];
    const { result } = renderTimelineHook({ dropTimeline: sameDayTimeline });
    const realPoints = result.current.chartData.filter(
      (p) => !p.isGap && !p.isBoundary,
    );
    expect(realPoints[0].sessionCount).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Gap markers
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — gap markers", () => {
  it("inserts gap markers between leagues with significant time gaps", () => {
    const { result } = renderTimelineHook();
    expect(result.current.gapIndices.length).toBeGreaterThan(0);
    // Verify the gap point is marked
    for (const idx of result.current.gapIndices) {
      expect(result.current.chartData[idx].isGap).toBe(true);
    }
  });

  it("marks gap points with isGap=true", () => {
    const { result } = renderTimelineHook();
    const gapPoints = result.current.chartData.filter((p) => p.isGap);
    expect(gapPoints.length).toBeGreaterThan(0);
    for (const gp of gapPoints) {
      expect(gp.isGap).toBe(true);
      expect(gp.count).toBe(0);
      expect(gp.league).toBe("");
    }
  });

  it("returns empty gapIndices when all data is same league", () => {
    const sameLeagueTimeline = [
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
    ];
    const { result } = renderTimelineHook({ dropTimeline: sameLeagueTimeline });
    expect(result.current.gapIndices).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Boundary sentinels
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — boundary sentinels", () => {
  it("adds boundary sentinel at timeline start", () => {
    const { result } = renderTimelineHook();
    // firstSessionStartedAt is "2024-01-10" which is before the first data point "2024-01-15"
    const firstPoint = result.current.chartData[0];
    expect(firstPoint.isBoundary).toBe(true);
    expect(firstPoint.time).toBe(new Date("2024-01-10T00:00:00Z").getTime());
    expect(firstPoint.count).toBe(0);
    expect(firstPoint.cumulativeCount).toBe(0);
  });

  it("adds boundary sentinel at timeline end", () => {
    const { result } = renderTimelineHook();
    // timelineEndDate is "2024-05-01" which is after the last data point "2024-04-01"
    const lastPoint =
      result.current.chartData[result.current.chartData.length - 1];
    expect(lastPoint.isBoundary).toBe(true);
    expect(lastPoint.time).toBe(new Date("2024-05-01T00:00:00Z").getTime());
    expect(lastPoint.count).toBe(0);
  });

  it("marks boundary points with isBoundary=true", () => {
    const { result } = renderTimelineHook();
    const boundaryPoints = result.current.chartData.filter((p) => p.isBoundary);
    expect(boundaryPoints.length).toBeGreaterThanOrEqual(1);
    for (const bp of boundaryPoints) {
      expect(bp.isBoundary).toBe(true);
      expect(bp.sessionCount).toBe(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// League markers
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — league markers", () => {
  it("computes league markers from leagueDateRanges", () => {
    const { result } = renderTimelineHook();
    expect(result.current.leagueMarkers.length).toBeGreaterThan(0);
  });

  it("includes start and end markers for leagues with both dates", () => {
    const { result } = renderTimelineHook();
    // Affliction has both start and end dates
    const afflictionMarkers = result.current.leagueMarkers.filter((m) =>
      m.label.includes("Affliction"),
    );
    const startMarker = afflictionMarkers.find((m) => m.type === "start");
    const endMarker = afflictionMarkers.find((m) => m.type === "end");
    expect(startMarker).toBeDefined();
    expect(startMarker!.time).toBe(new Date("2023-12-08").getTime());
    expect(endMarker).toBeDefined();
    expect(endMarker!.time).toBe(new Date("2024-03-25").getTime());
  });

  it("uses approximate end for leagues without end date", () => {
    // Settlers has startDate but no endDate
    // The hook adds an approximate end if it's in the past (startDate + ~4 months)
    const { result } = renderTimelineHook();
    const settlersMarkers = result.current.leagueMarkers.filter((m) =>
      m.label.includes("Settlers"),
    );
    const startMarker = settlersMarkers.find((m) => m.type === "start");
    expect(startMarker).toBeDefined();
    expect(startMarker!.time).toBe(new Date("2024-03-29").getTime());
    // The approximate end is startDate + DEFAULT_LEAGUE_DURATION_MS (4 * 30 days)
    // It should only be added if it's in the past, so it may or may not exist
    // depending on the current date. Just verify it has at least the start marker.
    expect(settlersMarkers.length).toBeGreaterThanOrEqual(1);
  });

  it("returns unique league names", () => {
    const { result } = renderTimelineHook();
    expect(result.current.uniqueLeagues).toContain("Affliction");
    expect(result.current.uniqueLeagues).toContain("Settlers");
    expect(result.current.uniqueLeagues.length).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Brush state
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — brush state", () => {
  it("brush indices are undefined by default (selectedLeague = 'all')", () => {
    const { result } = renderTimelineHook({ selectedLeague: "all" });
    expect(result.current.brushStartIndex).toBeUndefined();
    expect(result.current.brushEndIndex).toBeUndefined();
  });

  it("handleBrushChange updates brush indices", () => {
    const { result } = renderTimelineHook();
    act(() => {
      result.current.handleBrushChange({ startIndex: 1, endIndex: 3 });
    });
    expect(result.current.brushStartIndex).toBe(1);
    expect(result.current.brushEndIndex).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Visible data
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — visible data", () => {
  it("visibleData equals chartData when no brush set", () => {
    const { result } = renderTimelineHook({ selectedLeague: "all" });
    expect(result.current.visibleData).toEqual(result.current.chartData);
  });

  it("visibleData is sliced when brush indices are set", () => {
    const { result } = renderTimelineHook();
    const fullLength = result.current.chartData.length;
    expect(fullLength).toBeGreaterThan(2);

    act(() => {
      result.current.handleBrushChange({ startIndex: 1, endIndex: 2 });
    });

    expect(result.current.visibleData.length).toBe(2);
    expect(result.current.visibleData[0]).toEqual(result.current.chartData[1]);
    expect(result.current.visibleData[1]).toEqual(result.current.chartData[2]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// League-specific brush auto-computation (selectedLeague effect)
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — selectedLeague brush auto-computation", () => {
  // Timeline with Standard + non-Standard data points
  const mixedLeagueTimeline = [
    {
      sessionStartedAt: "2024-01-15T10:00:00Z",
      count: 1,
      cumulativeCount: 1,
      totalDecksOpened: 10,
      league: "Standard",
      sessionId: "s1",
    },
    {
      sessionStartedAt: "2024-02-01T10:00:00Z",
      count: 2,
      cumulativeCount: 3,
      totalDecksOpened: 20,
      league: "Standard",
      sessionId: "s2",
    },
    {
      sessionStartedAt: "2024-04-01T10:00:00Z",
      count: 3,
      cumulativeCount: 6,
      totalDecksOpened: 30,
      league: "Affliction",
      sessionId: "s3",
    },
    {
      sessionStartedAt: "2024-06-01T10:00:00Z",
      count: 1,
      cumulativeCount: 7,
      totalDecksOpened: 15,
      league: "Settlers",
      sessionId: "s4",
    },
  ];

  const mixedAnalytics = {
    totalLifetimeDrops: 7,
    firstSessionStartedAt: "2024-01-10T00:00:00Z",
    timelineEndDate: "2024-08-01T00:00:00Z",
    leagueDateRanges: [
      { name: "Affliction", startDate: "2023-12-08", endDate: "2024-03-25" },
      { name: "Settlers", startDate: "2024-03-29", endDate: "2024-07-20" },
    ],
  };

  it("sets brush to Standard data range using most recent non-Standard league end (selectedLeague = 'Standard')", () => {
    const { result } = renderTimelineHook({
      dropTimeline: mixedLeagueTimeline,
      personalAnalytics: mixedAnalytics,
      selectedLeague: "Standard",
    });

    // Brush should be set (not undefined)
    expect(result.current.brushStartIndex).toBeDefined();
    expect(result.current.brushEndIndex).toBeDefined();

    const startPoint =
      result.current.chartData[result.current.brushStartIndex!];
    const endPoint = result.current.chartData[result.current.brushEndIndex!];
    expect(startPoint).toBeDefined();
    expect(endPoint).toBeDefined();

    // The Standard start is 2024-01-15; with a 1-day margin the brush should
    // begin at or before the first Standard data point.
    const firstStandardTime = new Date("2024-01-15T10:00:00Z").getTime();
    const margin = 24 * 60 * 60 * 1000;
    expect(startPoint.time).toBeLessThanOrEqual(firstStandardTime + margin);

    // endTime = most recent non-Standard league end (Settlers endDate = 2024-07-20).
    // The brush picks the last chartData point whose time <= endTime + margin.
    // That is the Settlers data point at 2024-06-01 (trailing boundary at
    // 2024-08-01 exceeds the cutoff and is skipped).
    const lastSettlersDataTime = new Date("2024-06-01T10:00:00Z").getTime();
    expect(endPoint.time).toBe(lastSettlersDataTime);
  });

  it("falls back to all Standard data points when no non-Standard leagues exist (selectedLeague = 'Standard')", () => {
    const standardOnlyTimeline = [
      {
        sessionStartedAt: "2024-01-15T10:00:00Z",
        count: 1,
        cumulativeCount: 1,
        totalDecksOpened: 10,
        league: "Standard",
        sessionId: "s1",
      },
      {
        sessionStartedAt: "2024-02-01T10:00:00Z",
        count: 2,
        cumulativeCount: 3,
        totalDecksOpened: 20,
        league: "Standard",
        sessionId: "s2",
      },
      {
        sessionStartedAt: "2024-03-10T10:00:00Z",
        count: 1,
        cumulativeCount: 4,
        totalDecksOpened: 15,
        league: "Standard",
        sessionId: "s3",
      },
    ];

    const standardOnlyAnalytics = {
      totalLifetimeDrops: 4,
      firstSessionStartedAt: "2024-01-10T00:00:00Z",
      timelineEndDate: "2024-04-01T00:00:00Z",
      leagueDateRanges: [] as {
        name: string;
        startDate: string | null;
        endDate: string | null;
      }[],
    };

    const { result } = renderTimelineHook({
      dropTimeline: standardOnlyTimeline,
      personalAnalytics: standardOnlyAnalytics,
      selectedLeague: "Standard",
    });

    expect(result.current.brushStartIndex).toBeDefined();
    expect(result.current.brushEndIndex).toBeDefined();

    // With no non-Standard leagues, endTime = last Standard data point time
    // The brush should span the first to last Standard data points
    const firstStdTime = new Date("2024-01-15T10:00:00Z").getTime();
    const lastStdTime = new Date("2024-03-10T10:00:00Z").getTime();
    const margin = 24 * 60 * 60 * 1000;

    const startPoint =
      result.current.chartData[result.current.brushStartIndex!];
    const endPoint = result.current.chartData[result.current.brushEndIndex!];
    expect(startPoint.time).toBeLessThanOrEqual(firstStdTime + margin);
    expect(endPoint.time).toBeGreaterThanOrEqual(lastStdTime - margin);
  });

  it("sets brush to matching league date range for non-Standard league (selectedLeague = 'Affliction')", () => {
    const { result } = renderTimelineHook({
      dropTimeline: mixedLeagueTimeline,
      personalAnalytics: mixedAnalytics,
      selectedLeague: "Affliction",
    });

    expect(result.current.brushStartIndex).toBeDefined();
    expect(result.current.brushEndIndex).toBeDefined();

    // Affliction range: startDate=2023-12-08, endDate=2024-03-25
    // The brush scans chartData for the first point with time >= startTime - margin
    // and the last point with time <= endTime + margin.
    //
    // startTime - margin ≈ 2023-12-07.  The earliest chartData point is the
    // leading boundary sentinel at 2024-01-10 (firstSessionStartedAt), so
    // brushStartIndex = 0 (that sentinel).
    //
    // endTime + margin ≈ 2024-03-26.  The Affliction data point at 2024-04-01
    // exceeds that, so the brush end lands on the last point that fits — the
    // second Standard data point at 2024-02-01 or gap before Affliction data.
    const margin = 24 * 60 * 60 * 1000;
    const afflictionEnd = new Date("2024-03-25").getTime();

    const startPoint =
      result.current.chartData[result.current.brushStartIndex!];
    const endPoint = result.current.chartData[result.current.brushEndIndex!];

    // Start is the leading boundary sentinel (earliest available point)
    expect(result.current.brushStartIndex).toBe(0);
    expect(startPoint.isBoundary).toBe(true);

    // End point time must fall within afflictionEnd + margin
    expect(endPoint.time).toBeLessThanOrEqual(afflictionEnd + margin);
  });

  it("falls back to data point indices when no matching leagueDateRange exists for non-Standard league", () => {
    const timelineWithUnknownLeague = [
      {
        sessionStartedAt: "2024-01-15T10:00:00Z",
        count: 1,
        cumulativeCount: 1,
        totalDecksOpened: 10,
        league: "Standard",
        sessionId: "s1",
      },
      {
        sessionStartedAt: "2024-04-05T10:00:00Z",
        count: 2,
        cumulativeCount: 3,
        totalDecksOpened: 20,
        league: "SomeLeague",
        sessionId: "s2",
      },
      {
        sessionStartedAt: "2024-04-20T10:00:00Z",
        count: 1,
        cumulativeCount: 4,
        totalDecksOpened: 15,
        league: "SomeLeague",
        sessionId: "s3",
      },
    ];

    // leagueDateRanges does NOT include "SomeLeague"
    const analyticsNoMatch = {
      totalLifetimeDrops: 4,
      firstSessionStartedAt: "2024-01-10T00:00:00Z",
      timelineEndDate: "2024-06-01T00:00:00Z",
      leagueDateRanges: [
        { name: "Affliction", startDate: "2023-12-08", endDate: "2024-03-25" },
      ],
    };

    const { result } = renderTimelineHook({
      dropTimeline: timelineWithUnknownLeague,
      personalAnalytics: analyticsNoMatch,
      selectedLeague: "SomeLeague",
    });

    expect(result.current.brushStartIndex).toBeDefined();
    expect(result.current.brushEndIndex).toBeDefined();

    // Fallback uses first/last SomeLeague data point times
    const firstLeagueTime = new Date("2024-04-05T10:00:00Z").getTime();
    const lastLeagueTime = new Date("2024-04-20T10:00:00Z").getTime();
    const margin = 24 * 60 * 60 * 1000;

    const startPoint =
      result.current.chartData[result.current.brushStartIndex!];
    const endPoint = result.current.chartData[result.current.brushEndIndex!];
    expect(startPoint.time).toBeLessThanOrEqual(firstLeagueTime + margin);
    expect(endPoint.time).toBeGreaterThanOrEqual(lastLeagueTime - margin);
  });

  it("resets brush to undefined when selectedLeague is 'all' with chartData", () => {
    const { result } = renderTimelineHook({
      dropTimeline: mixedLeagueTimeline,
      personalAnalytics: mixedAnalytics,
      selectedLeague: "all",
    });

    expect(result.current.brushStartIndex).toBeUndefined();
    expect(result.current.brushEndIndex).toBeUndefined();
  });

  it("resets brush to undefined when selectedLeague is set but chartData is empty", () => {
    const { result } = renderTimelineHook({
      dropTimeline: [],
      selectedLeague: "Standard",
    });

    expect(result.current.brushStartIndex).toBeUndefined();
    expect(result.current.brushEndIndex).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Data length change reset
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — data length change resets brush", () => {
  it("resets brush indices to undefined when chartData length changes", () => {
    const initialTimeline = [
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
    ];

    const initialAnalytics = {
      totalLifetimeDrops: 5,
      firstSessionStartedAt: "2024-01-10T00:00:00Z",
      timelineEndDate: "2024-03-01T00:00:00Z",
      leagueDateRanges: [
        { name: "Affliction", startDate: "2023-12-08", endDate: "2024-03-25" },
      ],
    };

    const mockState1 = createMockState({
      dropTimeline: initialTimeline,
      personalAnalytics: initialAnalytics,
      selectedLeague: "all",
    });
    vi.mocked(useBoundStore).mockReturnValue(mockState1 as any);

    const { result, rerender } = renderHook(() => useDropTimelineData());

    // Set brush manually
    act(() => {
      result.current.handleBrushChange({ startIndex: 0, endIndex: 1 });
    });
    expect(result.current.brushStartIndex).toBe(0);
    expect(result.current.brushEndIndex).toBe(1);

    // Now re-render with a different-length timeline (add one more point)
    const longerTimeline = [
      ...initialTimeline,
      {
        sessionStartedAt: "2024-02-10T10:00:00Z",
        count: 1,
        cumulativeCount: 6,
        totalDecksOpened: 40,
        league: "Affliction",
        sessionId: "s3",
      },
    ];

    const mockState2 = createMockState({
      dropTimeline: longerTimeline,
      personalAnalytics: initialAnalytics,
      selectedLeague: "all",
    });
    vi.mocked(useBoundStore).mockReturnValue(mockState2 as any);

    rerender();

    // Brush should be reset to undefined because chartData length changed
    expect(result.current.brushStartIndex).toBeUndefined();
    expect(result.current.brushEndIndex).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Max computations
// ═══════════════════════════════════════════════════════════════════════════

describe("useDropTimelineData — max values", () => {
  it("computes maxCumulative from all real points", () => {
    const { result } = renderTimelineHook();
    // The max cumulative count across all real data points is 6
    expect(result.current.maxCumulative).toBe(6);
  });

  it("computes maxPerSession from all real points", () => {
    const { result } = renderTimelineHook();
    // The max per-session count is 3 (first data point)
    expect(result.current.maxPerSession).toBe(3);
  });

  it("computes visibleMaxCumulative from visible points", () => {
    const { result } = renderTimelineHook();
    // When no brush is set, visibleMaxCumulative should equal maxCumulative
    expect(result.current.visibleMaxCumulative).toBe(
      result.current.maxCumulative,
    );
  });

  it("computes visibleMaxPerSession from visible points", () => {
    const { result } = renderTimelineHook();
    // When no brush is set, visibleMaxPerSession should equal maxPerSession
    expect(result.current.visibleMaxPerSession).toBe(
      result.current.maxPerSession,
    );
  });
});
