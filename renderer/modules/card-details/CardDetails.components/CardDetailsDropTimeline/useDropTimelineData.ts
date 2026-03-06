import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useBoundStore } from "~/renderer/store";

import { DEFAULT_LEAGUE_DURATION_MS, MIN_GAP_FOR_BREAK_MS } from "./constants";
import { leagueEndTime, leagueStartTime } from "./helpers";
import type { ChartDataPoint, LeagueMarker } from "./types";

// ─── Raw point type (before aggregation) ───────────────────────────────────

interface RawTimelinePoint {
  time: number;
  count: number;
  cumulativeCount: number;
  totalDecksOpened: number;
  league: string;
  sessionStartedAt: string;
  sessionId: string;
}

// ─── Return type ───────────────────────────────────────────────────────────

export interface DropTimelineData {
  /** Processed chart data points (with gap markers and boundary sentinels) */
  chartData: ChartDataPoint[];
  /** Indices in chartData that are synthetic gap markers */
  gapIndices: number[];
  /** League start/end reference line markers */
  leagueMarkers: LeagueMarker[];
  /** Unique league names present in the data */
  uniqueLeagues: string[];
  /** Current brush start index (undefined = show all) */
  brushStartIndex: number | undefined;
  /** Current brush end index (undefined = show all) */
  brushEndIndex: number | undefined;
  /** Handler for brush change events */
  handleBrushChange: (newState: {
    startIndex?: number;
    endIndex?: number;
  }) => void;
  /** Visible slice of chartData based on current brush position */
  visibleData: ChartDataPoint[];
  /** Global max cumulative count (across all data) */
  maxCumulative: number;
  /** Global max per-session count (across all data) */
  maxPerSession: number;
  /** Visible max cumulative count (within brush window) */
  visibleMaxCumulative: number;
  /** Visible max per-session count (within brush window) */
  visibleMaxPerSession: number;
}

// ─── Hook ──────────────────────────────────────────────────────────────────

/**
 * Custom hook that transforms raw drop timeline data into chart-ready
 * data structures with gap markers, boundary sentinels, league markers,
 * brush state management, and visible data slicing.
 *
 * Reads all data directly from the Zustand store — no props required.
 */
export function useDropTimelineData(): DropTimelineData {
  const {
    cardDetails: { personalAnalytics, getDropTimeline, selectedLeague },
  } = useBoundStore();

  const dropTimeline = getDropTimeline();
  const leagueDateRanges = personalAnalytics?.leagueDateRanges ?? [];

  // ─── Timeline bounds ───────────────────────────────────────────────
  // Start from the user's very first session (across all sessions, not
  // just this card) and end at the current/most recent league's end date.
  const timelineStartMs = personalAnalytics?.firstSessionStartedAt
    ? new Date(personalAnalytics.firstSessionStartedAt).getTime()
    : undefined;
  const timelineEndMs = personalAnalytics?.timelineEndDate
    ? new Date(personalAnalytics.timelineEndDate).getTime()
    : undefined;

  // ─── Brush controlled indices ──────────────────────────────────────

  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(
    undefined,
  );
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(
    undefined,
  );

  // ─── Build chart data with gap markers ─────────────────────────────

  const { chartData, gapIndices, leagueMarkers, uniqueLeagues } =
    useMemo(() => {
      if (dropTimeline.length === 0) {
        return {
          chartData: [] as ChartDataPoint[],
          gapIndices: [] as number[],
          leagueMarkers: [] as LeagueMarker[],
          uniqueLeagues: [] as string[],
        };
      }

      // Resolve the full timeline boundaries:
      // Start = user's very first session (across all sessions)
      // End   = most recent league's end date (or approximate)
      const boundaryStart = timelineStartMs;
      const boundaryEnd = timelineEndMs;

      // Build raw points from timeline
      const rawPoints: RawTimelinePoint[] = dropTimeline.map((p) => ({
        time: new Date(p.sessionStartedAt).getTime(),
        count: p.count,
        cumulativeCount: p.cumulativeCount,
        totalDecksOpened: p.totalDecksOpened,
        league: p.league,
        sessionStartedAt: p.sessionStartedAt,
        sessionId: p.sessionId,
      }));

      // Sort by time ascending (should already be, but ensure)
      rawPoints.sort((a, b) => a.time - b.time);

      // Aggregate same-day sessions: sum counts, keep highest cumulative,
      // sum decks opened, track session count
      function toDayKey(ts: number): string {
        const d = new Date(ts);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      }

      const aggregated: ChartDataPoint[] = [];
      let currentGroup: RawTimelinePoint[] = [];

      function flushGroup() {
        if (currentGroup.length === 0) return;
        const totalCount = currentGroup.reduce((s, p) => s + p.count, 0);
        const totalDecks = currentGroup.reduce(
          (s, p) => s + p.totalDecksOpened,
          0,
        );
        // Use the last point's cumulativeCount (highest in the day)
        const lastPoint = currentGroup[currentGroup.length - 1];
        aggregated.push({
          time: currentGroup[0].time,
          count: totalCount,
          cumulativeCount: lastPoint.cumulativeCount,
          totalDecksOpened: totalDecks,
          league: currentGroup[0].league,
          sessionStartedAt: currentGroup[0].sessionStartedAt,
          sessionId: currentGroup.map((p) => p.sessionId).join(","),
          sessionCount: currentGroup.length,
        });
      }

      for (const pt of rawPoints) {
        if (
          currentGroup.length > 0 &&
          (toDayKey(pt.time) !== toDayKey(currentGroup[0].time) ||
            pt.league !== currentGroup[0].league)
        ) {
          flushGroup();
          currentGroup = [];
        }
        currentGroup.push(pt);
      }
      flushGroup();

      // Detect league boundaries and insert gap markers
      const result: ChartDataPoint[] = [];
      const gaps: number[] = [];
      const leagues = new Set<string>();

      for (let i = 0; i < aggregated.length; i++) {
        const point = aggregated[i];
        leagues.add(point.league);

        // Check if we need a gap marker between this point and the previous
        if (i > 0) {
          const prev = aggregated[i - 1];
          const timeDiff = point.time - prev.time;

          // Different leagues with a significant gap
          if (prev.league !== point.league && timeDiff > MIN_GAP_FOR_BREAK_MS) {
            // Insert a gap marker at the midpoint
            const gapTime = prev.time + timeDiff / 2;
            const gapIdx = result.length;
            gaps.push(gapIdx);
            result.push({
              time: gapTime,
              count: 0,
              cumulativeCount: prev.cumulativeCount,
              totalDecksOpened: 0,
              league: "",
              sessionStartedAt: new Date(gapTime).toISOString(),
              sessionId: "",
              sessionCount: 0,
              isGap: true,
            });
          }
        }

        result.push(point);
      }

      // Insert invisible sentinel points at timeline boundaries so the
      // chart and brush span the user's full history — from their very
      // first session to the end of the current league.
      if (result.length > 0) {
        const firstReal = result[0];
        const lastReal = result[result.length - 1];
        const lastCumulative = lastReal.cumulativeCount;

        // Leading sentinel: user's first session start (if earlier than first data point)
        if (boundaryStart !== undefined && boundaryStart < firstReal.time) {
          result.unshift({
            time: boundaryStart,
            count: 0,
            cumulativeCount: 0,
            totalDecksOpened: 0,
            league: firstReal.league,
            sessionStartedAt: new Date(boundaryStart).toISOString(),
            sessionId: "",
            sessionCount: 0,
            isBoundary: true,
          });
          // Shift gap indices by 1 since we prepended
          for (let g = 0; g < gaps.length; g++) {
            gaps[g] += 1;
          }
        }

        // Trailing sentinel: end of current/most recent league
        if (boundaryEnd !== undefined && boundaryEnd > lastReal.time) {
          result.push({
            time: boundaryEnd,
            count: 0,
            cumulativeCount: lastCumulative,
            totalDecksOpened: 0,
            league: lastReal.league,
            sessionStartedAt: new Date(boundaryEnd).toISOString(),
            sessionId: "",
            sessionCount: 0,
            isBoundary: true,
          });
        }
      }

      // Build league markers from date ranges
      const markers: LeagueMarker[] = [];
      for (const lr of leagueDateRanges) {
        if (lr.startDate) {
          markers.push({
            time: new Date(lr.startDate).getTime(),
            label: `${lr.name} Start`,
            type: "start",
          });
        }
        if (lr.endDate) {
          markers.push({
            time: new Date(lr.endDate).getTime(),
            label: `${lr.name} End`,
            type: "end",
          });
        } else if (lr.startDate) {
          // No end date — show approximate end
          const approxEnd =
            new Date(lr.startDate).getTime() + DEFAULT_LEAGUE_DURATION_MS;
          // Only show approx end if it's in the past
          if (approxEnd < Date.now()) {
            markers.push({
              time: approxEnd,
              label: `~${lr.name} End`,
              type: "end",
            });
          }
        }
      }

      return {
        chartData: result,
        gapIndices: gaps,
        leagueMarkers: markers,
        uniqueLeagues: Array.from(leagues),
      };
    }, [dropTimeline, leagueDateRanges, timelineStartMs, timelineEndMs]);

  // ─── Auto-compute brush from selectedLeague ────────────────────────

  useEffect(() => {
    if (selectedLeague === "all" || chartData.length === 0) {
      setBrushStartIndex(undefined);
      setBrushEndIndex(undefined);
      return;
    }

    let startTime: number;
    let endTime: number;

    const isStandard = selectedLeague.toLowerCase() === "standard";

    if (isStandard) {
      // Standard league special handling:
      // - Start from the first Standard data point
      // - End at the approx end date of the currently ongoing league,
      //   or its actual end date if it has ended.
      const standardPoints = chartData.filter(
        (p) => p.league.toLowerCase() === "standard" && !p.isGap,
      );
      if (standardPoints.length === 0) return;

      startTime = standardPoints[0].time;

      // Find the most recent non-Standard league to use as the end boundary
      const nonStandardRanges = leagueDateRanges.filter(
        (l) => l.name.toLowerCase() !== "standard",
      );
      if (nonStandardRanges.length > 0) {
        // Sort by start date descending to find the most recent league
        const sorted = [...nonStandardRanges].sort(
          (a, b) => leagueStartTime(b) - leagueStartTime(a),
        );
        const mostRecent = sorted[0];
        endTime = leagueEndTime(mostRecent);
      } else {
        // No other leagues — just show all Standard data
        endTime = standardPoints[standardPoints.length - 1].time;
      }
    } else {
      // Non-Standard league: use league date range or data points
      const lr = leagueDateRanges.find((l) => l.name === selectedLeague);

      if (lr) {
        startTime = leagueStartTime(lr);
        endTime = leagueEndTime(lr);
      } else {
        // Fallback: find from data points
        const leaguePoints = chartData.filter(
          (p) => p.league === selectedLeague && !p.isGap,
        );
        if (leaguePoints.length === 0) return;
        startTime = leaguePoints[0].time;
        endTime = leaguePoints[leaguePoints.length - 1].time;
      }
    }

    // Find the chart data indices that fall within this range
    // Include a small margin to ensure the points at boundaries are visible
    const margin = 24 * 60 * 60 * 1000; // 1 day
    let firstIdx = 0;
    let lastIdx = chartData.length - 1;

    for (let i = 0; i < chartData.length; i++) {
      if (chartData[i].time >= startTime - margin) {
        firstIdx = i;
        break;
      }
    }

    for (let i = chartData.length - 1; i >= 0; i--) {
      if (chartData[i].time <= endTime + margin) {
        lastIdx = i;
        break;
      }
    }

    setBrushStartIndex(firstIdx);
    setBrushEndIndex(lastIdx);
  }, [selectedLeague, chartData, leagueDateRanges]);

  // ─── Handle brush change ───────────────────────────────────────────

  const handleBrushChange = useCallback(
    (newState: { startIndex?: number; endIndex?: number }) => {
      if (newState.startIndex !== undefined) {
        setBrushStartIndex(newState.startIndex);
      }
      if (newState.endIndex !== undefined) {
        setBrushEndIndex(newState.endIndex);
      }
    },
    [],
  );

  // Reset brush when data changes
  const prevDataLengthRef = useRef(chartData.length);
  useEffect(() => {
    if (chartData.length !== prevDataLengthRef.current) {
      prevDataLengthRef.current = chartData.length;
      setBrushStartIndex(undefined);
      setBrushEndIndex(undefined);
    }
  }, [chartData.length]);

  // ─── Compute visible data slice from brush indices ─────────────────

  const visibleData = useMemo(() => {
    if (
      brushStartIndex === undefined ||
      brushEndIndex === undefined ||
      chartData.length === 0
    ) {
      return chartData;
    }
    return chartData.slice(brushStartIndex, brushEndIndex + 1);
  }, [chartData, brushStartIndex, brushEndIndex]);

  // ─── Compute Y domains (global for overview, dynamic for main) ─────

  const { maxCumulative, maxPerSession } = useMemo(() => {
    const realPoints = chartData.filter((p) => !p.isGap && !p.isBoundary);
    if (realPoints.length === 0) return { maxCumulative: 1, maxPerSession: 1 };
    return {
      maxCumulative: Math.max(...realPoints.map((d) => d.cumulativeCount)),
      maxPerSession: Math.max(...realPoints.map((d) => d.count)),
    };
  }, [chartData]);

  const { visibleMaxCumulative, visibleMaxPerSession } = useMemo(() => {
    const realPoints = visibleData.filter((p) => !p.isGap && !p.isBoundary);
    if (realPoints.length === 0)
      return {
        visibleMaxCumulative: maxCumulative,
        visibleMaxPerSession: maxPerSession,
      };
    return {
      visibleMaxCumulative: Math.max(
        ...realPoints.map((d) => d.cumulativeCount),
      ),
      visibleMaxPerSession: Math.max(...realPoints.map((d) => d.count)),
    };
  }, [visibleData, maxCumulative, maxPerSession]);

  return {
    chartData,
    gapIndices,
    leagueMarkers,
    uniqueLeagues,
    brushStartIndex,
    brushEndIndex,
    handleBrushChange,
    visibleData,
    maxCumulative,
    maxPerSession,
    visibleMaxCumulative,
    visibleMaxPerSession,
  };
}
