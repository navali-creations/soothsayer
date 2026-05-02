import type { LeagueDateRangeDTO } from "~/main/modules/card-details/CardDetails.dto";
import type { ChartLegendItem } from "~/renderer/components/CombinedChartCanvas";
import type { ChartColors } from "~/renderer/components/CombinedChartCanvas/chart-types/chart-types";

import {
  BOUNDARY_GAP_MATCH_TOLERANCE_MS,
  LEADING_BOUNDARY_GAP_OFFSET_MS,
  LEAGUE_MARKER_DOMAIN_PADDING_RATIO,
  LEAGUE_VIEW_MARKER_PADDING_MS,
  MIN_GAP_FOR_BREAK_MS,
  MIN_LEAGUE_MARKER_DOMAIN_PADDING_MS,
  ONE_DAY_MS,
  TRAILING_BOUNDARY_GAP_OFFSET_MS,
} from "./constants";
import { leagueEndTime, leagueStartTime } from "./helpers";
import type {
  ChartDataPoint,
  DropTimelineMetricKey,
  InactivityGapRange,
  LeagueMarker,
} from "./types";

interface LeagueDateRangesLike {
  leagueDateRanges?: LeagueDateRangeDTO[] | null;
}

export function countRealDataPoints(chartData: ChartDataPoint[]) {
  let count = 0;
  for (const point of chartData) {
    if (!point.isGap && !point.isBoundary) count++;
  }
  return count;
}

export function getDropSessionTimeline(chartData: ChartDataPoint[]) {
  const filteredData = chartData.filter(
    (point) => point.isBoundary || isDropSessionPoint(point),
  );

  if (!filteredData.some(isDropSessionPoint)) return [];

  return insertDropSessionGaps(filteredData);
}

export function formatSingleDropTimelineSessionDate(sessionStartedAt: string) {
  return new Date(sessionStartedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getInactivityGap({
  chartData,
  selectedLeague,
  visibleTimeMax,
  now = new Date(),
}: {
  chartData: ChartDataPoint[];
  selectedLeague: string;
  visibleTimeMax: number;
  now?: Date;
}): InactivityGapRange | null {
  if (selectedLeague !== "all") return null;

  let lastRealPoint: ChartDataPoint | undefined;
  for (let i = chartData.length - 1; i >= 0; i--) {
    const point = chartData[i];
    if (!point.isGap && !point.isBoundary) {
      lastRealPoint = point;
      break;
    }
  }
  if (!lastRealPoint) return null;

  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const yesterdayEnd = startOfToday - 1;
  const cappedGapEnd = Math.min(yesterdayEnd, visibleTimeMax);
  const gapStartTime = lastRealPoint.time + 3 * ONE_DAY_MS;
  if (cappedGapEnd <= gapStartTime) return null;

  return {
    startTime: gapStartTime,
    endTime: cappedGapEnd,
  };
}

export function getCompressedGapRanges({
  chartData,
  gapIndices,
  selectedLeague,
  personalAnalytics,
  visibleTimeMin,
  visibleTimeMax,
}: {
  chartData: ChartDataPoint[];
  gapIndices: number[];
  selectedLeague: string;
  personalAnalytics: LeagueDateRangesLike | null | undefined;
  visibleTimeMin: number;
  visibleTimeMax: number;
}): InactivityGapRange[] {
  const ranges: InactivityGapRange[] = [];

  if (gapIndices.length > 0 && chartData.length >= 3) {
    for (const gapIndex of gapIndices) {
      const prev = chartData[gapIndex - 1];
      const gap = chartData[gapIndex];
      const next = chartData[gapIndex + 1];
      if (!prev || !gap || !next || !gap.isGap) continue;
      if (prev.isGap || prev.isBoundary || next.isGap || next.isBoundary) {
        continue;
      }

      const rawStart = prev.time + 3 * ONE_DAY_MS;
      const rawEnd = next.time - 2 * ONE_DAY_MS;
      const startTime = Math.max(rawStart, visibleTimeMin);
      const endTime = Math.min(rawEnd, visibleTimeMax);
      if (endTime <= startTime) continue;

      ranges.push({ startTime, endTime });
    }
  }

  if (selectedLeague === "all" || chartData.length < 2) return ranges;

  const selectedStartTime = getSelectedLeagueStartTime({
    selectedLeague,
    personalAnalytics,
  });
  const firstRealPointAfterStart = getFirstRealPointAfterStart({
    chartData,
    selectedStartTime,
  });

  if (
    selectedStartTime !== undefined &&
    firstRealPointAfterStart &&
    firstRealPointAfterStart.time - selectedStartTime > MIN_GAP_FOR_BREAK_MS
  ) {
    const rawStart = selectedStartTime + LEADING_BOUNDARY_GAP_OFFSET_MS;
    const rawEnd =
      firstRealPointAfterStart.time - TRAILING_BOUNDARY_GAP_OFFSET_MS;
    if (rawEnd > rawStart) {
      ranges.push({ startTime: rawStart, endTime: rawEnd });
    }
  }

  const trailingBoundaryIndex = getTrailingBoundaryIndex(chartData);
  if (trailingBoundaryIndex <= 0) return ranges;

  const trailingBoundary = chartData[trailingBoundaryIndex];
  const lastRealPointBeforeBoundary = getLastRealPointBeforeIndex(
    chartData,
    trailingBoundaryIndex,
  );

  if (
    lastRealPointBeforeBoundary &&
    trailingBoundary.time - lastRealPointBeforeBoundary.time >
      MIN_GAP_FOR_BREAK_MS
  ) {
    const rawStart =
      lastRealPointBeforeBoundary.time + LEADING_BOUNDARY_GAP_OFFSET_MS;
    const rawEnd = trailingBoundary.time - TRAILING_BOUNDARY_GAP_OFFSET_MS;
    if (rawEnd > rawStart) {
      ranges.push({ startTime: rawStart, endTime: rawEnd });
    }
  }

  return ranges;
}

export function getSelectedLeagueMarkers({
  selectedLeague,
  personalAnalytics,
  chartData,
}: {
  selectedLeague: string;
  personalAnalytics: LeagueDateRangesLike | null | undefined;
  chartData: ChartDataPoint[];
}): LeagueMarker[] {
  if (selectedLeague === "all") return [];
  const normalizedSelectedLeague = normalizeLeagueName(selectedLeague);
  if (!normalizedSelectedLeague) return [];

  const leagueRanges = personalAnalytics?.leagueDateRanges ?? [];
  const selectedRange = findSelectedRange(leagueRanges, selectedLeague);

  let selectedStartTime: number | undefined;
  let selectedEndTime: number | undefined;

  if (selectedRange) {
    const start = leagueStartTime(selectedRange);
    if (Number.isFinite(start) && start > 0) {
      selectedStartTime = start;
    }
    const end = leagueEndTime(selectedRange, leagueRanges);
    if (Number.isFinite(end)) {
      selectedEndTime = end;
    }
  } else {
    const leaguePoints = chartData.filter(
      (point) =>
        !point.isGap &&
        !point.isBoundary &&
        normalizeLeagueName(point.league) === normalizedSelectedLeague,
    );
    if (leaguePoints.length > 0) {
      selectedStartTime = leaguePoints[0].time;
      selectedEndTime = leaguePoints[leaguePoints.length - 1].time;
    }
  }

  const markers: LeagueMarker[] = [];
  if (selectedStartTime !== undefined) {
    markers.push({
      time: selectedStartTime,
      label: "League Start",
      type: "start",
      emphasis: "muted",
    });
  }
  if (
    selectedEndTime !== undefined &&
    (selectedStartTime === undefined || selectedEndTime > selectedStartTime)
  ) {
    markers.push({
      time: selectedEndTime,
      label: "League End",
      type: "end",
      emphasis: "muted",
    });
  }
  return markers;
}

export function getVisibleMarkers({
  selectedLeague,
  activeLeagueStartMarker,
  selectedLeagueMarkers,
  visibleTimeMin,
  visibleTimeMax,
}: {
  selectedLeague: string;
  activeLeagueStartMarker: LeagueMarker | null;
  selectedLeagueMarkers: LeagueMarker[];
  visibleTimeMin: number;
  visibleTimeMax: number;
}): LeagueMarker[] {
  if (selectedLeague !== "all") {
    return selectedLeagueMarkers.filter((marker) =>
      isTimeInVisibleRange(marker.time, visibleTimeMin, visibleTimeMax),
    );
  }

  if (
    activeLeagueStartMarker &&
    isTimeInVisibleRange(
      activeLeagueStartMarker.time,
      visibleTimeMin,
      visibleTimeMax,
    )
  ) {
    return [activeLeagueStartMarker];
  }

  return [];
}

export function getRenderedCompressedGaps({
  compressedGapRanges,
  selectedLeague,
  activeLeagueStartMarker,
  selectedLeagueMarkers,
}: {
  compressedGapRanges: InactivityGapRange[];
  selectedLeague: string;
  activeLeagueStartMarker: LeagueMarker | null;
  selectedLeagueMarkers: LeagueMarker[];
}) {
  const selectedLeagueStartMarkerTime =
    selectedLeagueMarkers.find((marker) => marker.type === "start")?.time ??
    null;
  const selectedLeagueEndMarkerTime =
    selectedLeagueMarkers.find((marker) => marker.type === "end")?.time ?? null;

  return compressedGapRanges.filter((gap) => {
    if (selectedLeague === "all") {
      if (!activeLeagueStartMarker) return true;
      return !(
        activeLeagueStartMarker.time > gap.startTime &&
        activeLeagueStartMarker.time < gap.endTime
      );
    }

    const isLeadingBoundaryGap =
      selectedLeagueStartMarkerTime !== null &&
      Math.abs(
        gap.startTime -
          (selectedLeagueStartMarkerTime + LEADING_BOUNDARY_GAP_OFFSET_MS),
      ) <= BOUNDARY_GAP_MATCH_TOLERANCE_MS;
    const isTrailingBoundaryGap =
      selectedLeagueEndMarkerTime !== null &&
      Math.abs(
        gap.endTime -
          (selectedLeagueEndMarkerTime - TRAILING_BOUNDARY_GAP_OFFSET_MS),
      ) <= BOUNDARY_GAP_MATCH_TOLERANCE_MS;

    return !isLeadingBoundaryGap && !isTrailingBoundaryGap;
  });
}

export function getMainChartTimeDomain({
  visibleMarkers,
  visibleTimeMin,
  visibleTimeMax,
  selectedLeague,
}: {
  visibleMarkers: LeagueMarker[];
  visibleTimeMin: number;
  visibleTimeMax: number;
  selectedLeague: string;
}) {
  const markerDomainPadding = Math.max(
    MIN_LEAGUE_MARKER_DOMAIN_PADDING_MS,
    Math.max(0, visibleTimeMax - visibleTimeMin) *
      LEAGUE_MARKER_DOMAIN_PADDING_RATIO,
  );
  const markerPadding =
    selectedLeague === "all"
      ? markerDomainPadding
      : LEAGUE_VIEW_MARKER_PADDING_MS;
  const markerTimes = visibleMarkers
    .map((marker) => marker.time)
    .filter((time) => Number.isFinite(time));

  if (markerTimes.length === 0) {
    return { min: visibleTimeMin, max: visibleTimeMax };
  }

  return {
    min: Math.min(
      visibleTimeMin,
      ...markerTimes.map((time) => time - markerPadding),
    ),
    max: Math.max(
      visibleTimeMax,
      ...markerTimes.map((time) => time + markerPadding),
    ),
  };
}

export function createDropTimelineLegendItems({
  colors,
  hiddenMetrics,
  visibleMarkers,
  selectedLeague,
  hasGapIndicators,
  toggleMetric,
}: {
  colors: ChartColors;
  hiddenMetrics: Set<DropTimelineMetricKey>;
  visibleMarkers: LeagueMarker[];
  selectedLeague: string;
  hasGapIndicators: boolean;
  toggleMetric: (key: DropTimelineMetricKey) => void;
}): ChartLegendItem[] {
  const legendItems: ChartLegendItem[] = [
    {
      id: "drops-per-day",
      label: "Drops / Day",
      visual: "bar",
      color: colors.primary,
      hidden: hiddenMetrics.has("drops-per-day"),
      onClick: () => toggleMetric("drops-per-day"),
    },
    {
      id: "anticipated",
      label: "Expected to Drop",
      visual: "bar",
      color: colors.bc35,
      hidden: hiddenMetrics.has("anticipated"),
      onClick: () => toggleMetric("anticipated"),
    },
    {
      id: "decks-opened",
      label: "Decks Opened",
      visual: "line",
      color: colors.bc30,
      hidden: hiddenMetrics.has("decks-opened"),
      onClick: () => toggleMetric("decks-opened"),
    },
  ];

  if (visibleMarkers.length > 0) {
    legendItems.push({
      id: "league-start",
      label: selectedLeague === "all" ? "League Start" : "League Bounds",
      visual: "dashed-line",
      color: selectedLeague === "all" ? colors.success50 : colors.bc35,
      hidden: hiddenMetrics.has("league-start"),
      onClick: () => toggleMetric("league-start"),
    });
  }

  if (hasGapIndicators) {
    legendItems.push({
      id: "compressed-gaps",
      label: "Compressed Gaps",
      visual: "zigzag-gap",
      color: colors.bc35,
    });
  }

  return legendItems;
}

function normalizeLeagueName(league: string) {
  return league.trim().toLowerCase();
}

function findSelectedRange(
  ranges: LeagueDateRangeDTO[],
  selectedLeague: string,
) {
  const normalizedSelectedLeague = normalizeLeagueName(selectedLeague);
  return ranges.find(
    (range) => normalizeLeagueName(range.name) === normalizedSelectedLeague,
  );
}

function getSelectedLeagueStartTime({
  selectedLeague,
  personalAnalytics,
}: {
  selectedLeague: string;
  personalAnalytics: LeagueDateRangesLike | null | undefined;
}) {
  const selectedRange = findSelectedRange(
    personalAnalytics?.leagueDateRanges ?? [],
    selectedLeague,
  );
  if (!selectedRange) return undefined;

  const start = leagueStartTime(selectedRange);
  if (!Number.isFinite(start) || start <= 0) return undefined;

  return start;
}

function getFirstRealPointAfterStart({
  chartData,
  selectedStartTime,
}: {
  chartData: ChartDataPoint[];
  selectedStartTime: number | undefined;
}) {
  for (const point of chartData) {
    if (point.isGap || point.isBoundary) continue;
    if (selectedStartTime !== undefined && point.time < selectedStartTime) {
      continue;
    }
    return point;
  }

  return null;
}

function getTrailingBoundaryIndex(chartData: ChartDataPoint[]) {
  for (let i = chartData.length - 1; i >= 0; i--) {
    if (chartData[i].isBoundary) return i;
  }

  return -1;
}

function getLastRealPointBeforeIndex(
  chartData: ChartDataPoint[],
  boundaryIndex: number,
) {
  for (let i = boundaryIndex - 1; i >= 0; i--) {
    const point = chartData[i];
    if (point.isGap || point.isBoundary) continue;
    return point;
  }

  return null;
}

function isTimeInVisibleRange(
  time: number,
  visibleTimeMin: number,
  visibleTimeMax: number,
) {
  return (
    Number.isFinite(visibleTimeMin) &&
    Number.isFinite(visibleTimeMax) &&
    time >= visibleTimeMin &&
    time <= visibleTimeMax
  );
}

function isDropSessionPoint(point: ChartDataPoint | undefined) {
  return Boolean(point && !point.isGap && !point.isBoundary && point.count > 0);
}

function insertDropSessionGaps(chartData: ChartDataPoint[]) {
  const result: ChartDataPoint[] = [];
  let previousDropSession: ChartDataPoint | undefined;

  for (const point of chartData) {
    if (isDropSessionPoint(point)) {
      if (
        previousDropSession &&
        point.time - previousDropSession.time > MIN_GAP_FOR_BREAK_MS
      ) {
        result.push(
          createDropSessionGapPoint({
            previous: previousDropSession,
            next: point,
          }),
        );
      }

      previousDropSession = point;
    }

    result.push(point);
  }

  return result;
}

function createDropSessionGapPoint({
  previous,
  next,
}: {
  previous: ChartDataPoint;
  next: ChartDataPoint;
}): ChartDataPoint {
  const time = previous.time + (next.time - previous.time) / 2;

  return {
    time,
    count: 0,
    cumulativeCount: previous.cumulativeCount,
    totalDecksOpened: 0,
    league: "",
    sessionStartedAt: new Date(time).toISOString(),
    sessionId: "",
    sessionCount: 0,
    isGap: true,
  };
}
