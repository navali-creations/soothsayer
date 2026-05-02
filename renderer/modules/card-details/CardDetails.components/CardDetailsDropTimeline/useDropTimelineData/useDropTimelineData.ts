import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useCardDetails } from "~/renderer/store";

import { leagueEndTime, leagueStartTime } from "../helpers";
import type { ChartDataPoint, LeagueMarker } from "../types";

function normalizeLeagueName(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

function lowerBoundByTime(data: ChartDataPoint[], time: number): number {
  let low = 0;
  let high = data.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (data[mid].time < time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function upperBoundByTime(data: ChartDataPoint[], time: number): number {
  let low = 0;
  let high = data.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (data[mid].time <= time) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

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
  /** Current brush start timestamp (undefined = show all) */
  brushStartTime: number | undefined;
  /** Current brush end timestamp (undefined = show all) */
  brushEndTime: number | undefined;
  /** Handler for brush change events */
  handleBrushChange: (newState: {
    startIndex?: number;
    endIndex?: number;
    startTime?: number;
    endTime?: number;
  }) => void;
  /** Visible slice of chartData based on current brush position */
  visibleData: ChartDataPoint[];
  /** Visible time-domain start used by the main chart */
  visibleTimeMin: number;
  /** Visible time-domain end used by the main chart */
  visibleTimeMax: number;
  /** Global max cumulative count (across all data) */
  maxCumulative: number;
  /** Global max per-session count (across all data) */
  maxPerSession: number;
  /** Visible max cumulative count (within brush window) */
  visibleMaxCumulative: number;
  /** Visible max per-session count (within brush window) */
  visibleMaxPerSession: number;
}

export function useDropTimelineData(
  dropTimeline?: ChartDataPoint[],
): DropTimelineData {
  const { personalAnalytics, getDropTimeline, selectedLeague } =
    useCardDetails();

  const chartData = dropTimeline ?? getDropTimeline();
  const leagueDateRanges = personalAnalytics?.leagueDateRanges ?? [];
  const normalizedSelectedLeague = normalizeLeagueName(selectedLeague);

  const [brushStartIndex, setBrushStartIndex] = useState<number | undefined>(
    undefined,
  );
  const [brushEndIndex, setBrushEndIndex] = useState<number | undefined>(
    undefined,
  );
  const [brushStartTime, setBrushStartTime] = useState<number | undefined>(
    undefined,
  );
  const [brushEndTime, setBrushEndTime] = useState<number | undefined>(
    undefined,
  );

  const { gapIndices, leagueMarkers, uniqueLeagues } = useMemo(() => {
    const gaps: number[] = [];
    const leagues = new Set<string>();
    if (chartData.length === 0) {
      return {
        gapIndices: gaps,
        leagueMarkers: [] as LeagueMarker[],
        uniqueLeagues: [] as string[],
      };
    }

    for (let i = 0; i < chartData.length; i++) {
      const point = chartData[i];
      if (point.isGap) {
        gaps.push(i);
        continue;
      }
      if (!point.isBoundary && point.league) {
        leagues.add(point.league);
      }
    }

    const markers: LeagueMarker[] = [];
    for (const range of leagueDateRanges) {
      if (range.startDate) {
        markers.push({
          time: new Date(range.startDate).getTime(),
          label: `${range.name} Start`,
          type: "start",
        });
      }
      if (range.endDate) {
        markers.push({
          time: new Date(range.endDate).getTime(),
          label: `${range.name} End`,
          type: "end",
        });
      }
    }

    return {
      gapIndices: gaps,
      leagueMarkers: markers,
      uniqueLeagues: Array.from(leagues),
    };
  }, [chartData, leagueDateRanges]);

  useEffect(() => {
    if (normalizedSelectedLeague === "all" || chartData.length === 0) {
      setBrushStartIndex(undefined);
      setBrushEndIndex(undefined);
      setBrushStartTime(undefined);
      setBrushEndTime(undefined);
      return;
    }

    let startTime: number;
    let endTime: number;

    if (normalizedSelectedLeague === "standard") {
      const standardPoints = chartData.filter(
        (point) =>
          normalizeLeagueName(point.league) === "standard" &&
          !point.isGap &&
          !point.isBoundary,
      );
      if (standardPoints.length === 0) return;

      startTime = standardPoints[0].time;

      const nonStandardRanges = leagueDateRanges.filter(
        (range) => normalizeLeagueName(range.name) !== "standard",
      );
      if (nonStandardRanges.length > 0) {
        const sorted = [...nonStandardRanges].sort(
          (a, b) => leagueStartTime(b) - leagueStartTime(a),
        );
        endTime = leagueEndTime(sorted[0], leagueDateRanges);
      } else {
        endTime = standardPoints[standardPoints.length - 1].time;
      }
    } else {
      const selectedRange = leagueDateRanges.find(
        (range) => normalizeLeagueName(range.name) === normalizedSelectedLeague,
      );

      if (selectedRange) {
        startTime = leagueStartTime(selectedRange);
        endTime = leagueEndTime(selectedRange, leagueDateRanges);
      } else {
        const leaguePoints = chartData.filter(
          (point) =>
            normalizeLeagueName(point.league) === normalizedSelectedLeague &&
            !point.isGap &&
            !point.isBoundary,
        );
        if (leaguePoints.length === 0) return;
        startTime = leaguePoints[0].time;
        endTime = leaguePoints[leaguePoints.length - 1].time;
      }
    }

    const margin = 24 * 60 * 60 * 1000;
    const timelineMin = chartData[0].time;
    const timelineMax = chartData[chartData.length - 1].time;
    const nextStartTime = Math.max(timelineMin, startTime - margin);
    const nextEndTime = Math.min(timelineMax, endTime + margin);
    const nextStartIndex = Math.min(
      chartData.length - 1,
      lowerBoundByTime(chartData, nextStartTime),
    );
    const nextEndIndex = Math.max(
      0,
      upperBoundByTime(chartData, nextEndTime) - 1,
    );

    setBrushStartIndex(nextStartIndex);
    setBrushEndIndex(nextEndIndex);
    setBrushStartTime(nextStartTime);
    setBrushEndTime(nextEndTime);
  }, [chartData, leagueDateRanges, normalizedSelectedLeague]);

  const handleBrushChange = useCallback(
    (newState: {
      startIndex?: number;
      endIndex?: number;
      startTime?: number;
      endTime?: number;
    }) => {
      if (newState.startIndex !== undefined) {
        setBrushStartIndex(newState.startIndex);
        setBrushStartTime(chartData[newState.startIndex]?.time);
      }
      if (newState.endIndex !== undefined) {
        setBrushEndIndex(newState.endIndex);
        setBrushEndTime(chartData[newState.endIndex]?.time);
      }
      if (newState.startTime !== undefined) {
        const nextStartTime = newState.startTime;
        const nextStartIndex = lowerBoundByTime(chartData, nextStartTime);
        setBrushStartTime(nextStartTime);
        setBrushStartIndex(
          nextStartIndex >= chartData.length
            ? chartData.length - 1
            : nextStartIndex,
        );
      }
      if (newState.endTime !== undefined) {
        const nextEndTime = newState.endTime;
        const nextEndIndex = upperBoundByTime(chartData, nextEndTime) - 1;
        setBrushEndTime(nextEndTime);
        setBrushEndIndex(nextEndIndex < 0 ? 0 : nextEndIndex);
      }
    },
    [chartData],
  );

  const prevDataLengthRef = useRef(chartData.length);
  useEffect(() => {
    if (chartData.length !== prevDataLengthRef.current) {
      prevDataLengthRef.current = chartData.length;
      setBrushStartIndex(undefined);
      setBrushEndIndex(undefined);
      setBrushStartTime(undefined);
      setBrushEndTime(undefined);
    }
  }, [chartData.length]);

  const visibleData = useMemo(() => {
    if (
      brushStartTime === undefined ||
      brushEndTime === undefined ||
      chartData.length === 0
    ) {
      return chartData;
    }

    const startIndex = lowerBoundByTime(chartData, brushStartTime);
    const endIndex = upperBoundByTime(chartData, brushEndTime);
    return chartData.slice(startIndex, endIndex);
  }, [chartData, brushEndTime, brushStartTime]);

  const { visibleTimeMin, visibleTimeMax } = useMemo(() => {
    if (chartData.length === 0) {
      return { visibleTimeMin: 0, visibleTimeMax: 1 };
    }
    return {
      visibleTimeMin: brushStartTime ?? chartData[0].time,
      visibleTimeMax: brushEndTime ?? chartData[chartData.length - 1].time,
    };
  }, [brushEndTime, brushStartTime, chartData]);

  const { maxCumulative, maxPerSession } = useMemo(() => {
    let maxCumulativeValue = 1;
    let maxPerSessionValue = 1;

    for (const point of chartData) {
      if (point.isGap || point.isBoundary) continue;
      maxCumulativeValue = Math.max(maxCumulativeValue, point.cumulativeCount);
      maxPerSessionValue = Math.max(maxPerSessionValue, point.count);
    }

    return {
      maxCumulative: maxCumulativeValue,
      maxPerSession: maxPerSessionValue,
    };
  }, [chartData]);

  const { visibleMaxCumulative, visibleMaxPerSession } = useMemo(() => {
    let hasRealPoint = false;
    let maxCumulativeValue = 1;
    let maxPerSessionValue = 1;

    for (const point of visibleData) {
      if (point.isGap || point.isBoundary) continue;
      hasRealPoint = true;
      maxCumulativeValue = Math.max(maxCumulativeValue, point.cumulativeCount);
      maxPerSessionValue = Math.max(maxPerSessionValue, point.count);
    }

    if (!hasRealPoint) {
      return {
        visibleMaxCumulative: maxCumulative,
        visibleMaxPerSession: maxPerSession,
      };
    }

    return {
      visibleMaxCumulative: maxCumulativeValue,
      visibleMaxPerSession: maxPerSessionValue,
    };
  }, [visibleData, maxCumulative, maxPerSession]);

  return {
    chartData,
    gapIndices,
    leagueMarkers,
    uniqueLeagues,
    brushStartIndex,
    brushEndIndex,
    brushStartTime,
    brushEndTime,
    handleBrushChange,
    visibleData,
    visibleTimeMin,
    visibleTimeMax,
    maxCumulative,
    maxPerSession,
    visibleMaxCumulative,
    visibleMaxPerSession,
  };
}
