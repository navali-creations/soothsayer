import { describe, expect, it } from "vitest";

import {
  getDropSessionTimeline,
  getMainChartTimeDomain,
  getRenderedCompressedGaps,
  getVisibleMarkers,
} from "./CardDetailsDropTimeline.utils";
import type { ChartDataPoint, LeagueMarker } from "./types";

function point(
  id: string,
  overrides: Partial<ChartDataPoint> = {},
): ChartDataPoint {
  const time = new Date(`2026-01-${id.padStart(2, "0")}T00:00:00.000Z`);

  return {
    time: time.getTime(),
    sessionStartedAt: time.toISOString(),
    sessionId: `s${id}`,
    count: 1,
    cumulativeCount: 1,
    totalDecksOpened: 10,
    league: "Keepers",
    sessionCount: 1,
    ...overrides,
  };
}

describe("getDropSessionTimeline", () => {
  it("removes real sessions without drops and keeps drop sessions", () => {
    const zeroDrop = point("02", {
      count: 0,
      cumulativeCount: 1,
      totalDecksOpened: 60,
    });
    const dropA = point("03", { sessionId: "drop-a", count: 2 });
    const dropB = point("20", { sessionId: "drop-b", count: 1 });

    const result = getDropSessionTimeline([
      point("01", {
        count: 0,
        cumulativeCount: 0,
        totalDecksOpened: 0,
        sessionCount: 0,
        isBoundary: true,
      }),
      zeroDrop,
      dropA,
      point("10", {
        count: 0,
        cumulativeCount: 3,
        totalDecksOpened: 0,
        league: "",
        sessionCount: 0,
        isGap: true,
      }),
      dropB,
      point("30", {
        count: 0,
        cumulativeCount: 4,
        totalDecksOpened: 0,
        sessionCount: 0,
        isBoundary: true,
      }),
    ]);

    expect(result).toEqual([
      expect.objectContaining({ isBoundary: true }),
      dropA,
      expect.objectContaining({ isGap: true }),
      dropB,
      expect.objectContaining({ isBoundary: true }),
    ]);
    expect(result).not.toContain(zeroDrop);
  });

  it("recomputes compressed gap markers after zero-drop sessions are removed", () => {
    const dropA = point("01", {
      count: 2,
      cumulativeCount: 2,
      sessionId: "drop-a",
    });
    const zeroDrop = point("10", {
      count: 0,
      cumulativeCount: 2,
      totalDecksOpened: 80,
      sessionId: "zero-drop",
    });
    const dropB = point("20", {
      count: 1,
      cumulativeCount: 3,
      sessionId: "drop-b",
    });

    const result = getDropSessionTimeline([dropA, zeroDrop, dropB]);

    expect(result).toEqual([
      dropA,
      expect.objectContaining({
        time: dropA.time + (dropB.time - dropA.time) / 2,
        count: 0,
        cumulativeCount: dropA.cumulativeCount,
        totalDecksOpened: 0,
        league: "",
        sessionId: "",
        sessionCount: 0,
        isGap: true,
      }),
      dropB,
    ]);
    expect(result).not.toContain(zeroDrop);
  });

  it("drops gap markers that no longer sit between two drop sessions", () => {
    const result = getDropSessionTimeline([
      point("01", { count: 2, sessionId: "drop-a" }),
      point("10", {
        count: 0,
        cumulativeCount: 2,
        totalDecksOpened: 0,
        league: "",
        sessionCount: 0,
        isGap: true,
      }),
      point("20", {
        count: 0,
        cumulativeCount: 2,
        totalDecksOpened: 80,
        sessionId: "zero-drop",
      }),
    ]);

    expect(result).toEqual([expect.objectContaining({ sessionId: "drop-a" })]);
  });

  it("returns empty data when there are no drop sessions", () => {
    const result = getDropSessionTimeline([
      point("01", {
        count: 0,
        cumulativeCount: 0,
        totalDecksOpened: 0,
        sessionCount: 0,
        isBoundary: true,
      }),
      point("02", {
        count: 0,
        cumulativeCount: 0,
        totalDecksOpened: 50,
        sessionId: "zero-drop",
      }),
    ]);

    expect(result).toEqual([]);
  });
});

describe("getVisibleMarkers", () => {
  it("shows every visible league start and highlights the active league", () => {
    const keepersStart: LeagueMarker = {
      time: 100,
      label: "Keepers",
      type: "start",
    };
    const mirageStart: LeagueMarker = {
      time: 200,
      label: "Mirage",
      type: "start",
    };
    const activeMirage: LeagueMarker = {
      ...mirageStart,
      emphasis: "highlight",
    };

    const result = getVisibleMarkers({
      selectedLeague: "all",
      activeLeagueStartMarker: activeMirage,
      leagueMarkers: [
        keepersStart,
        { time: 175, label: "Keepers End", type: "end" },
        mirageStart,
        { time: 400, label: "Future League", type: "start" },
      ],
      selectedLeagueMarkers: [],
      visibleTimeMin: 50,
      visibleTimeMax: 250,
    });

    expect(result).toEqual([keepersStart, activeMirage]);
  });

  it("adds an active league start missing from personal league ranges", () => {
    const activeAllflame: LeagueMarker = {
      time: 300,
      label: "Allflame",
      type: "start",
      emphasis: "highlight",
    };

    const result = getVisibleMarkers({
      selectedLeague: "all",
      activeLeagueStartMarker: activeAllflame,
      leagueMarkers: [{ time: 100, label: "Keepers", type: "start" }],
      selectedLeagueMarkers: [],
      visibleTimeMin: 50,
      visibleTimeMax: 350,
    });

    expect(result).toEqual([
      { time: 100, label: "Keepers", type: "start" },
      activeAllflame,
    ]);
  });

  it("keeps the selected league bounds in a filtered league view", () => {
    const selectedLeagueMarkers: LeagueMarker[] = [
      { time: 100, label: "League Start", type: "start" },
      { time: 200, label: "League End", type: "end" },
    ];

    const result = getVisibleMarkers({
      selectedLeague: "Keepers",
      activeLeagueStartMarker: null,
      leagueMarkers: [{ time: 150, label: "Mirage", type: "start" }],
      selectedLeagueMarkers,
      visibleTimeMin: 50,
      visibleTimeMax: 250,
    });

    expect(result).toEqual(selectedLeagueMarkers);
  });
});

describe("getRenderedCompressedGaps", () => {
  it("suppresses gaps containing any visible league start", () => {
    const result = getRenderedCompressedGaps({
      compressedGapRanges: [
        { startTime: 100, endTime: 200 },
        { startTime: 300, endTime: 400 },
      ],
      selectedLeague: "all",
      visibleMarkers: [
        { time: 150, label: "Keepers", type: "start" },
        { time: 350, label: "Keepers End", type: "end" },
      ],
      selectedLeagueMarkers: [],
    });

    expect(result).toEqual([{ startTime: 300, endTime: 400 }]);
  });

  it("renders a selected league's leading gap but hides its trailing boundary gap", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const leagueStart = new Date("2025-10-31T19:00:00.000Z").getTime();
    const leagueEnd = new Date("2026-03-04T00:00:00.000Z").getTime();
    const leadingGap = {
      startTime: leagueStart + 3 * oneDay,
      endTime: new Date("2025-12-15T00:00:00.000Z").getTime(),
    };
    const trailingGap = {
      startTime: new Date("2026-02-22T00:00:00.000Z").getTime(),
      endTime: leagueEnd - 2 * oneDay,
    };

    const result = getRenderedCompressedGaps({
      compressedGapRanges: [leadingGap, trailingGap],
      selectedLeague: "Keepers",
      visibleMarkers: [],
      selectedLeagueMarkers: [
        { time: leagueStart, label: "League Start", type: "start" },
        { time: leagueEnd, label: "League End", type: "end" },
      ],
    });

    expect(result).toEqual([leadingGap]);
  });
});

describe("getMainChartTimeDomain", () => {
  it("adds only a fixed one-day leading pad to the all-leagues boundary", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const keepersStart = new Date("2025-10-31T19:00:00.000Z").getTime();
    const visibleTimeMax = keepersStart + 100 * oneDay;

    const result = getMainChartTimeDomain({
      visibleMarkers: [{ time: keepersStart, label: "Keepers", type: "start" }],
      visibleTimeMin: keepersStart,
      visibleTimeMax,
      selectedLeague: "all",
    });

    expect(result).toEqual({
      min: keepersStart - oneDay,
      max: visibleTimeMax,
    });
  });
});
