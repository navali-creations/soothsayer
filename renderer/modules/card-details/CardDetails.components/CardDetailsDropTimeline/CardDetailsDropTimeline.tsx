import { useCallback, useMemo, useState } from "react";

import {
  ChartLegend,
  type ChartLegendItem,
} from "~/renderer/components/CombinedChartCanvas";
import { useChartColors } from "~/renderer/hooks";
import { zoomIndexBrush } from "~/renderer/lib/canvas-core";
import { resolveActiveLeagueStartMarker } from "~/renderer/lib/league-start-marker";
import { useCardDetails, useLeagues, useSettings } from "~/renderer/store";

import {
  BOUNDARY_GAP_MATCH_TOLERANCE_MS,
  LEADING_BOUNDARY_GAP_OFFSET_MS,
  LEAGUE_MARKER_DOMAIN_PADDING_RATIO,
  LEAGUE_VIEW_MARKER_PADDING_MS,
  MIN_BRUSH_DATA_POINTS,
  MIN_GAP_FOR_BREAK_MS,
  MIN_LEAGUE_MARKER_DOMAIN_PADDING_MS,
  MIN_ZOOM_WINDOW,
  ONE_DAY_MS,
  TRAILING_BOUNDARY_GAP_OFFSET_MS,
  ZOOM_STEP,
} from "./constants";
import { leagueEndTime, leagueStartTime } from "./helpers";
import MainChart from "./MainChart/MainChart";
import OverviewChart from "./OverviewChart/OverviewChart";
import type {
  DropTimelineMetricKey,
  InactivityGapRange,
  LeagueMarker,
} from "./types";
import { useDropTimelineData } from "./useDropTimelineData/useDropTimelineData";

// ─── Main Component ────────────────────────────────────────────────────────

/**
 * Multi-league personal drop timeline chart for the card details page.
 *
 * Renders a combined ComposedChart with:
 * - **Bar metrics**: Actual drops and expected drops
 * - **Line metrics**: Decks opened for each timeline point
 * - **Brush**: Pan/zoom at the bottom
 * - **League markers**: Dashed reference lines for league start/end dates
 * - **Zigzag gaps**: Visual break markers between leagues with no activity
 *
 * Data spans ALL leagues the user has participated in. When leagues have
 * temporal gaps (no activity between them), a zigzag pattern is inserted
 * to indicate the timeline was compressed.
 *
 * No props — reads all data from the Zustand store via `useDropTimelineData`.
 */
const CardDetailsDropTimeline = () => {
  const c = useChartColors();
  const [hiddenMetrics, setHiddenMetrics] = useState<
    Set<DropTimelineMetricKey>
  >(new Set());

  const { personalAnalytics, getDropTimeline, selectedLeague } =
    useCardDetails();
  const { getLeaguesForGame } = useLeagues();
  const { getSelectedGame, getActiveGameViewSelectedLeague } = useSettings();

  const dropTimeline = getDropTimeline();
  const activeGame = getSelectedGame();
  const activeGlobalLeague = getActiveGameViewSelectedLeague();
  const activeGameLeagues = getLeaguesForGame(activeGame);

  const {
    chartData,
    gapIndices,
    brushStartIndex,
    brushEndIndex,
    brushStartTime,
    brushEndTime,
    handleBrushChange,
    visibleData,
    visibleTimeMin,
    visibleTimeMax,
    maxPerSession,
  } = useDropTimelineData();
  const realDataPointCount = chartData.filter(
    (point) => !point.isGap && !point.isBoundary,
  ).length;
  const showBrush = realDataPointCount > MIN_BRUSH_DATA_POINTS;
  const handleWheelZoom = useCallback(
    ({ deltaY, focusRatio }: { deltaY: number; focusRatio: number }) => {
      if (!showBrush) return;
      if (chartData.length <= MIN_ZOOM_WINDOW) return;
      if (Math.abs(deltaY) < 1) return;

      const currentRange = {
        startIndex: brushStartIndex ?? 0,
        endIndex: brushEndIndex ?? chartData.length - 1,
      };
      const centeredNextRange = zoomIndexBrush({
        range: currentRange,
        itemCount: chartData.length,
        deltaY,
        minSpan: MIN_ZOOM_WINDOW,
        zoomStep: ZOOM_STEP,
      });
      const currentSpan = currentRange.endIndex - currentRange.startIndex;
      const nextSpan =
        centeredNextRange.endIndex - centeredNextRange.startIndex;

      if (
        centeredNextRange.startIndex === currentRange.startIndex &&
        centeredNextRange.endIndex === currentRange.endIndex
      ) {
        return;
      }

      const anchorRatio = Number.isFinite(focusRatio)
        ? Math.max(0, Math.min(1, focusRatio))
        : 0.5;
      const anchorIndex =
        currentRange.startIndex + anchorRatio * Math.max(0, currentSpan);
      const maxStart = Math.max(0, chartData.length - 1 - nextSpan);
      let nextStart = Math.round(anchorIndex - anchorRatio * nextSpan);
      nextStart = Math.max(0, Math.min(maxStart, nextStart));
      let nextEnd = nextStart + nextSpan;

      if (nextEnd > chartData.length - 1) {
        nextEnd = chartData.length - 1;
        nextStart = Math.max(0, nextEnd - nextSpan);
      }

      if (
        nextStart === currentRange.startIndex &&
        nextEnd === currentRange.endIndex
      ) {
        return;
      }

      handleBrushChange({ startIndex: nextStart, endIndex: nextEnd });
    },
    [
      brushEndIndex,
      brushStartIndex,
      chartData.length,
      handleBrushChange,
      showBrush,
    ],
  );
  const inactivityGap = useMemo(() => {
    if (selectedLeague !== "all") return null;

    const realPoints = chartData.filter(
      (point) => !point.isGap && !point.isBoundary,
    );
    const lastRealPoint = realPoints[realPoints.length - 1];
    if (!lastRealPoint) return null;

    const now = new Date();
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
  }, [chartData, selectedLeague, visibleTimeMax]);
  const compressedGapRanges = useMemo<InactivityGapRange[]>(() => {
    const ranges: InactivityGapRange[] = [];

    if (gapIndices.length > 0 && chartData.length >= 3) {
      for (const gapIndex of gapIndices) {
        const prev = chartData[gapIndex - 1];
        const gap = chartData[gapIndex];
        const next = chartData[gapIndex + 1];
        if (!prev || !gap || !next || !gap.isGap) continue;
        if (prev.isGap || prev.isBoundary || next.isGap || next.isBoundary)
          continue;

        const rawStart = prev.time + 3 * ONE_DAY_MS;
        // Keep an extra trailing-day buffer so the zig-zag doesn't visually
        // stick to the next real session point.
        const rawEnd = next.time - 2 * ONE_DAY_MS;
        const startTime = Math.max(rawStart, visibleTimeMin);
        const endTime = Math.min(rawEnd, visibleTimeMax);
        if (endTime <= startTime) continue;

        ranges.push({ startTime, endTime });
      }
    }

    if (selectedLeague !== "all" && chartData.length >= 2) {
      const normalizedSelectedLeague = selectedLeague.trim().toLowerCase();
      const leagueRanges = personalAnalytics?.leagueDateRanges ?? [];
      const selectedRange = leagueRanges.find(
        (range) => range.name.trim().toLowerCase() === normalizedSelectedLeague,
      );

      let selectedStartTime: number | undefined;
      if (selectedRange) {
        const start = leagueStartTime(selectedRange);
        if (Number.isFinite(start) && start > 0) {
          selectedStartTime = start;
        }
      }

      let firstRealPointAfterStart: (typeof chartData)[number] | null = null;
      for (const point of chartData) {
        if (point.isGap || point.isBoundary) continue;
        if (selectedStartTime !== undefined && point.time < selectedStartTime) {
          continue;
        }
        firstRealPointAfterStart = point;
        break;
      }

      if (
        selectedStartTime !== undefined &&
        firstRealPointAfterStart &&
        firstRealPointAfterStart.time - selectedStartTime > MIN_GAP_FOR_BREAK_MS
      ) {
        const rawStart = selectedStartTime + LEADING_BOUNDARY_GAP_OFFSET_MS;
        const rawEnd =
          firstRealPointAfterStart.time - TRAILING_BOUNDARY_GAP_OFFSET_MS;
        const startTime = rawStart;
        const endTime = rawEnd;
        if (endTime > startTime) {
          ranges.push({ startTime, endTime });
        }
      }

      let trailingBoundaryIndex = -1;
      for (let i = chartData.length - 1; i >= 0; i--) {
        if (chartData[i].isBoundary) {
          trailingBoundaryIndex = i;
          break;
        }
      }

      if (trailingBoundaryIndex > 0) {
        const trailingBoundary = chartData[trailingBoundaryIndex];
        let lastRealPointBeforeBoundary: (typeof chartData)[number] | null =
          null;

        for (let i = trailingBoundaryIndex - 1; i >= 0; i--) {
          const point = chartData[i];
          if (point.isGap || point.isBoundary) continue;
          lastRealPointBeforeBoundary = point;
          break;
        }

        if (
          lastRealPointBeforeBoundary &&
          trailingBoundary.time - lastRealPointBeforeBoundary.time >
            MIN_GAP_FOR_BREAK_MS
        ) {
          const rawStart =
            lastRealPointBeforeBoundary.time + LEADING_BOUNDARY_GAP_OFFSET_MS;
          const rawEnd =
            trailingBoundary.time - TRAILING_BOUNDARY_GAP_OFFSET_MS;
          const startTime = rawStart;
          const endTime = rawEnd;
          if (endTime > startTime) {
            ranges.push({ startTime, endTime });
          }
        }
      }
    }

    return ranges;
  }, [
    chartData,
    gapIndices,
    personalAnalytics,
    selectedLeague,
    visibleTimeMax,
    visibleTimeMin,
  ]);

  // ─── Early returns ──────────────────────────────────────────────────

  const toggleMetric = useCallback((key: DropTimelineMetricKey) => {
    setHiddenMetrics((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  if (!personalAnalytics || personalAnalytics.totalLifetimeDrops === 0) {
    return null;
  }

  if (dropTimeline.length === 0) {
    return null;
  }

  // Single data point — simplified view
  if (dropTimeline.length === 1) {
    const point = dropTimeline[0];
    const date = new Date(point.sessionStartedAt).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return (
      <div className="bg-base-200 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Drop Timeline
        </h3>
        <div className="flex items-center justify-center py-4">
          <p className="text-sm text-base-content/50">
            Found {point.count} card{point.count !== 1 ? "s" : ""} in a single
            session on {date} ({point.league})
          </p>
        </div>
      </div>
    );
  }

  // ─── Filter reference lines to visible range ────────────────────────

  const resolvedMarker = resolveActiveLeagueStartMarker({
    leagues: activeGameLeagues,
    activeLeague: activeGlobalLeague,
    enabled: selectedLeague === "all",
  });
  const activeLeagueStartMarker: LeagueMarker | null = resolvedMarker
    ? { ...resolvedMarker, type: "start", emphasis: "highlight" }
    : null;
  const selectedLeagueMarkers = (() => {
    if (selectedLeague === "all") return [] as LeagueMarker[];
    const normalizedSelectedLeague = selectedLeague.trim().toLowerCase();
    if (!normalizedSelectedLeague) return [] as LeagueMarker[];

    const leagueRanges = personalAnalytics.leagueDateRanges ?? [];
    const selectedRange = leagueRanges.find(
      (range) => range.name.trim().toLowerCase() === normalizedSelectedLeague,
    );

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
          point.league.trim().toLowerCase() === normalizedSelectedLeague,
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
  })();
  const isMarkerInVisibleRange =
    activeLeagueStartMarker &&
    Number.isFinite(visibleTimeMin) &&
    Number.isFinite(visibleTimeMax)
      ? activeLeagueStartMarker.time >= visibleTimeMin &&
        activeLeagueStartMarker.time <= visibleTimeMax
      : false;
  const visibleSelectedLeagueMarkers =
    selectedLeague === "all"
      ? []
      : selectedLeagueMarkers.filter(
          (marker) =>
            marker.time >= visibleTimeMin && marker.time <= visibleTimeMax,
        );
  const visibleMarkers: LeagueMarker[] =
    selectedLeague === "all"
      ? activeLeagueStartMarker && isMarkerInVisibleRange
        ? [activeLeagueStartMarker]
        : []
      : visibleSelectedLeagueMarkers;
  const selectedLeagueStartMarkerTime =
    selectedLeagueMarkers.find((marker) => marker.type === "start")?.time ??
    null;
  const selectedLeagueEndMarkerTime =
    selectedLeagueMarkers.find((marker) => marker.type === "end")?.time ?? null;
  const renderedCompressedGaps = compressedGapRanges.filter((gap) => {
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
  const hasGapIndicators =
    renderedCompressedGaps.length > 0 || inactivityGap !== null;

  const markerDomainPadding = Math.max(
    MIN_LEAGUE_MARKER_DOMAIN_PADDING_MS,
    Math.max(0, visibleTimeMax - visibleTimeMin) *
      LEAGUE_MARKER_DOMAIN_PADDING_RATIO,
  );
  const markerTimes = visibleMarkers
    .map((marker) => marker.time)
    .filter((time) => Number.isFinite(time));
  const markerPadding =
    selectedLeague === "all"
      ? markerDomainPadding
      : LEAGUE_VIEW_MARKER_PADDING_MS;
  const mainChartTimeMin =
    markerTimes.length > 0
      ? Math.min(
          visibleTimeMin,
          ...markerTimes.map((time) => time - markerPadding),
        )
      : visibleTimeMin;
  const mainChartTimeMax =
    markerTimes.length > 0
      ? Math.max(
          visibleTimeMax,
          ...markerTimes.map((time) => time + markerPadding),
        )
      : visibleTimeMax;

  const legendItems: ChartLegendItem[] = [
    {
      id: "drops-per-day",
      label: "Drops / Day",
      visual: "bar" as const,
      color: c.primary,
      hidden: hiddenMetrics.has("drops-per-day"),
      onClick: () => toggleMetric("drops-per-day"),
    },
    {
      id: "anticipated",
      label: "Expected to Drop",
      visual: "bar" as const,
      color: c.bc35,
      hidden: hiddenMetrics.has("anticipated"),
      onClick: () => toggleMetric("anticipated"),
    },
    {
      id: "decks-opened",
      label: "Decks Opened",
      visual: "line" as const,
      color: c.bc30,
      hidden: hiddenMetrics.has("decks-opened"),
      onClick: () => toggleMetric("decks-opened"),
    },
  ];
  if (visibleMarkers.length > 0) {
    legendItems.push({
      id: "league-start",
      label: selectedLeague === "all" ? "League Start" : "League Bounds",
      visual: "dashed-line" as const,
      color: selectedLeague === "all" ? c.success50 : c.bc35,
      hidden: hiddenMetrics.has("league-start"),
      onClick: () => toggleMetric("league-start"),
    });
  }
  if (hasGapIndicators) {
    legendItems.push({
      id: "compressed-gaps",
      label: "Compressed Gaps",
      visual: "zigzag-gap" as const,
      color: c.bc35,
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Drop Timeline
        </h3>
        <ChartLegend items={legendItems} />
      </div>

      {/* Main chart: deck volume, expected drops, and actual drops */}
      <MainChart
        chartData={chartData}
        visibleData={visibleData}
        maxPerSession={maxPerSession}
        hiddenMetrics={hiddenMetrics}
        compressedGaps={compressedGapRanges}
        renderedCompressedGaps={renderedCompressedGaps}
        inactivityGap={inactivityGap}
        visibleMarkers={visibleMarkers}
        visibleTimeMin={mainChartTimeMin}
        visibleTimeMax={mainChartTimeMax}
        onWheelZoom={handleWheelZoom}
        c={c}
      />

      {/* Overview chart: actual drop bars + brush */}
      {showBrush && (
        <OverviewChart
          chartData={chartData}
          maxPerSession={maxPerSession}
          hiddenMetrics={hiddenMetrics}
          leagueStartTime={
            selectedLeague === "all" ? activeLeagueStartMarker?.time : undefined
          }
          onWheelZoom={handleWheelZoom}
          brushStartTime={brushStartTime}
          brushEndTime={brushEndTime}
          handleBrushChange={handleBrushChange}
          c={c}
        />
      )}
    </div>
  );
};

export default CardDetailsDropTimeline;
