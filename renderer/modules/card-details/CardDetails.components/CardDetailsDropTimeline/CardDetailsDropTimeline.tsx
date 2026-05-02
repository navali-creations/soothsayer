import { useCallback, useMemo, useState } from "react";

import { ChartLegend } from "~/renderer/components/CombinedChartCanvas";
import { useChartColors } from "~/renderer/hooks";
import { zoomIndexBrush } from "~/renderer/lib/canvas-core";
import { resolveActiveLeagueStartMarker } from "~/renderer/lib/league-start-marker";
import { useCardDetails, useLeagues, useSettings } from "~/renderer/store";

import {
  countRealDataPoints,
  createDropTimelineLegendItems,
  formatSingleDropTimelineSessionDate,
  getCompressedGapRanges,
  getDropSessionTimeline,
  getInactivityGap,
  getMainChartTimeDomain,
  getRenderedCompressedGaps,
  getSelectedLeagueMarkers,
  getVisibleMarkers,
} from "./CardDetailsDropTimeline.utils";
import { MIN_BRUSH_DATA_POINTS, MIN_ZOOM_WINDOW, ZOOM_STEP } from "./constants";
import MainChart from "./MainChart/MainChart";
import OverviewChart from "./OverviewChart/OverviewChart";
import type { DropTimelineMetricKey, LeagueMarker } from "./types";
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
  const [includeAllSessions, setIncludeAllSessions] = useState(false);

  const { personalAnalytics, getDropTimeline, selectedLeague } =
    useCardDetails();
  const { getLeaguesForGame } = useLeagues();
  const { getSelectedGame, getActiveGameViewSelectedLeague } = useSettings();

  const dropTimeline = getDropTimeline();
  const visibleDropTimeline = useMemo(
    () =>
      includeAllSessions ? dropTimeline : getDropSessionTimeline(dropTimeline),
    [dropTimeline, includeAllSessions],
  );
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
  } = useDropTimelineData(visibleDropTimeline);
  const realDataPointCount = useMemo(
    () => countRealDataPoints(chartData),
    [chartData],
  );
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
  const inactivityGap = useMemo(
    () =>
      getInactivityGap({
        chartData,
        selectedLeague,
        visibleTimeMax,
      }),
    [chartData, selectedLeague, visibleTimeMax],
  );
  const compressedGapRanges = useMemo(
    () =>
      getCompressedGapRanges({
        chartData,
        gapIndices,
        selectedLeague,
        personalAnalytics,
        visibleTimeMin,
        visibleTimeMax,
      }),
    [
      chartData,
      gapIndices,
      personalAnalytics,
      selectedLeague,
      visibleTimeMin,
      visibleTimeMax,
    ],
  );

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

  const activeLeagueStartMarker: LeagueMarker | null = useMemo(() => {
    const resolvedMarker = resolveActiveLeagueStartMarker({
      leagues: activeGameLeagues,
      activeLeague: activeGlobalLeague,
      enabled: selectedLeague === "all",
    });

    return resolvedMarker
      ? { ...resolvedMarker, type: "start", emphasis: "highlight" }
      : null;
  }, [activeGameLeagues, activeGlobalLeague, selectedLeague]);
  const selectedLeagueMarkers = useMemo(
    () =>
      getSelectedLeagueMarkers({
        selectedLeague,
        personalAnalytics,
        chartData,
      }),
    [chartData, personalAnalytics, selectedLeague],
  );
  const visibleMarkers = useMemo(
    () =>
      getVisibleMarkers({
        selectedLeague,
        activeLeagueStartMarker,
        selectedLeagueMarkers,
        visibleTimeMin,
        visibleTimeMax,
      }),
    [
      activeLeagueStartMarker,
      selectedLeague,
      selectedLeagueMarkers,
      visibleTimeMax,
      visibleTimeMin,
    ],
  );
  const renderedCompressedGaps = useMemo(
    () =>
      getRenderedCompressedGaps({
        compressedGapRanges,
        selectedLeague,
        activeLeagueStartMarker,
        selectedLeagueMarkers,
      }),
    [
      activeLeagueStartMarker,
      compressedGapRanges,
      selectedLeague,
      selectedLeagueMarkers,
    ],
  );
  const hasGapIndicators =
    renderedCompressedGaps.length > 0 || inactivityGap !== null;
  const mainChartTimeDomain = useMemo(
    () =>
      getMainChartTimeDomain({
        visibleMarkers,
        visibleTimeMin,
        visibleTimeMax,
        selectedLeague,
      }),
    [selectedLeague, visibleMarkers, visibleTimeMax, visibleTimeMin],
  );
  const legendItems = useMemo(
    () =>
      createDropTimelineLegendItems({
        colors: c,
        hiddenMetrics,
        visibleMarkers,
        selectedLeague,
        hasGapIndicators,
        toggleMetric,
      }),
    [
      c,
      hasGapIndicators,
      hiddenMetrics,
      selectedLeague,
      toggleMetric,
      visibleMarkers,
    ],
  );

  // ─── Early returns ──────────────────────────────────────────────────

  if (!personalAnalytics || personalAnalytics.totalLifetimeDrops === 0) {
    return null;
  }

  if (dropTimeline.length === 0) {
    return null;
  }

  if (visibleDropTimeline.length === 0) {
    return null;
  }

  // Single data point — simplified view
  if (visibleDropTimeline.length === 1) {
    const point = visibleDropTimeline[0];
    const date = formatSingleDropTimelineSessionDate(point.sessionStartedAt);

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

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase text-base-content/50">
            Drop Timeline
          </h3>
          <ChartLegend items={legendItems} />
        </div>
        <div className="flex justify-end">
          <label className="label cursor-pointer gap-2 py-0">
            <input
              type="checkbox"
              className="checkbox checkbox-xs checkbox-primary"
              checked={includeAllSessions}
              onChange={(event) =>
                setIncludeAllSessions(event.currentTarget.checked)
              }
            />
            <span className="label-text text-xs text-base-content/60">
              Include all sessions
            </span>
          </label>
        </div>
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
        visibleTimeMin={mainChartTimeDomain.min}
        visibleTimeMax={mainChartTimeDomain.max}
        onWheelZoom={handleWheelZoom}
        c={c}
      />

      {/* Overview chart: actual drop bars + brush */}
      {showBrush && (
        <OverviewChart
          chartData={chartData}
          maxPerSession={maxPerSession}
          hiddenMetrics={hiddenMetrics}
          showExpectedBars={includeAllSessions}
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
