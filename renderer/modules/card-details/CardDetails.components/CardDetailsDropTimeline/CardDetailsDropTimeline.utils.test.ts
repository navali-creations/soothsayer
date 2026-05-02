import { describe, expect, it } from "vitest";

import { getDropSessionTimeline } from "./CardDetailsDropTimeline.utils";
import type { ChartDataPoint } from "./types";

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
