import { useChartColors } from "~/renderer/hooks";
import { useCardDetails } from "~/renderer/store";

import MainChart from "./MainChart";
import OverviewChart from "./OverviewChart";
import type { LeagueMarker } from "./types";
import { useDropTimelineData } from "./useDropTimelineData/useDropTimelineData";

// ─── Main Component ────────────────────────────────────────────────────────

/**
 * Multi-league personal drop timeline chart for the card details page.
 *
 * Renders a combined ComposedChart with:
 * - **Area/Line** (left Y-axis): Cumulative total drops over time
 * - **Bar chart** (right Y-axis): Per-session drop counts
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

  const { personalAnalytics, getDropTimeline } = useCardDetails();

  const dropTimeline = getDropTimeline();

  const {
    chartData,
    gapIndices,
    leagueMarkers,
    uniqueLeagues,
    brushStartIndex,
    brushEndIndex,
    handleBrushChange,
    visibleData,
    maxPerSession,
    visibleMaxCumulative,
    visibleMaxPerSession,
  } = useDropTimelineData();

  // ─── Early returns ──────────────────────────────────────────────────

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

  const visibleTimeMin = visibleData[0]?.time ?? 0;
  const visibleTimeMax = visibleData[visibleData.length - 1]?.time ?? 0;
  const timeMargin = 7 * 24 * 60 * 60 * 1000; // 7 days
  const visibleMarkers: LeagueMarker[] = leagueMarkers.filter(
    (m) =>
      m.time >= visibleTimeMin - timeMargin &&
      m.time <= visibleTimeMax + timeMargin,
  );

  const showBrush = chartData.length > 2;

  // ─── Render ──────────────────────────────────────────────────────────

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Drop Timeline
        </h3>
      </div>

      {/* Main chart: cumulative line + per-day bars (zoomed view) */}
      <MainChart
        visibleData={visibleData}
        visibleMaxCumulative={visibleMaxCumulative}
        visibleMaxPerSession={visibleMaxPerSession}
        visibleMarkers={visibleMarkers}
        c={c}
      />

      {/* Overview chart: bars with count labels + brush (with cumulative line inside) */}
      {showBrush && (
        <OverviewChart
          chartData={chartData}
          maxPerSession={maxPerSession}
          brushStartIndex={brushStartIndex}
          brushEndIndex={brushEndIndex}
          handleBrushChange={handleBrushChange}
          c={c}
        />
      )}

      {/* Zigzag markers rendered as an overlay hint */}
      {gapIndices.length > 0 && (
        <div className="flex items-center gap-1.5 text-[10px] text-base-content/30">
          <span className="text-base-content/20">⦚</span>
          <span>
            Timeline compressed — gaps indicate periods with no activity
          </span>
        </div>
      )}

      {/* Footer stats */}
      <div className="flex items-center justify-between text-xs text-base-content/40 pt-1">
        <span>
          {chartData.filter((p) => !p.isGap && !p.isBoundary).length} day
          {chartData.filter((p) => !p.isGap && !p.isBoundary).length !== 1
            ? "s"
            : ""}{" "}
          across {uniqueLeagues.length} league
          {uniqueLeagues.length !== 1 ? "s" : ""}
        </span>
        <span>
          {personalAnalytics.totalLifetimeDrops} total drop
          {personalAnalytics.totalLifetimeDrops !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
};

export default CardDetailsDropTimeline;
