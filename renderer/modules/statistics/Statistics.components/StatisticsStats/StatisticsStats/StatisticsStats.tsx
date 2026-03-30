import { useEffect } from "react";

import { useBoundStore } from "~/renderer/store";

import { StatisticsOpenedDecksStat } from "../StatisticsOpenedDecksStat/StatisticsOpenedDecksStat";
import { StatsAvgDecksPerSession } from "../StatsAvgDecksPerSession/StatsAvgDecksPerSession";
import { StatsAvgProfitPerSession } from "../StatsAvgProfitPerSession/StatsAvgProfitPerSession";
import { StatsAvgSessionDuration } from "../StatsAvgSessionDuration/StatsAvgSessionDuration";
import { StatsBiggestLetdown } from "../StatsBiggestLetdown/StatsBiggestLetdown";
import { StatsLongestSession } from "../StatsLongestSession/StatsLongestSession";
import { StatsLuckyBreak } from "../StatsLuckyBreak/StatsLuckyBreak";
import { StatsMostDecksOpened } from "../StatsMostDecksOpened/StatsMostDecksOpened";
import { StatsMostProfitableSession } from "../StatsMostProfitableSession/StatsMostProfitableSession";
import { StatsUniqueCardsCollected } from "../StatsUniqueCardsCollected/StatsUniqueCardsCollected";

interface StatisticsStatsProps {
  totalCount: number;
  uniqueCardCount: number;
  isDataLoading?: boolean;
}

/**
 * Wrapper that places a `.stat` child into a grid cell with the correct
 * border dividers (right border between columns, bottom border on row 1).
 */
const Cell = ({
  children,
  isLastCol = false,
  isTopRow = false,
}: {
  children: React.ReactNode;
  isLastCol?: boolean;
  isTopRow?: boolean;
}) => (
  <div
    className={[
      "h-full [&>.stat]:h-full [&>.stat]:content-start border-dashed border-base-content/10",
      !isLastCol ? "border-r" : "",
      isTopRow ? "border-b" : "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
);

export const StatisticsStats = ({
  totalCount,
  uniqueCardCount,
  isDataLoading = false,
}: StatisticsStatsProps) => {
  const {
    statistics: {
      statScope,
      selectedLeague,
      sessionHighlights,
      stackedDeckCardCount,
      isLoadingHighlights,
      fetchSessionHighlights,
    },
  } = useBoundStore();

  useEffect(() => {
    const league =
      statScope === "league" && selectedLeague ? selectedLeague : undefined;
    fetchSessionHighlights("poe1", league);
  }, [statScope, selectedLeague, fetchSessionHighlights]);

  const isStale = isLoadingHighlights || isDataLoading;
  const averages = sessionHighlights?.averages ?? null;

  const isLeague = statScope === "league";

  return (
    <div className="w-full shadow rounded-box overflow-hidden relative">
      {isStale && (
        <div className="absolute inset-0 bg-base-200/60 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-lg pointer-events-none">
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
      )}

      <div
        className="grid w-full"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        {/* ── Row 1 — Highlights ─────────────────────────────────────── */}
        <Cell isTopRow>
          <StatisticsOpenedDecksStat
            totalCount={totalCount}
            sessionCount={averages?.sessionCount ?? null}
          />
        </Cell>
        <Cell isTopRow>
          <StatsMostProfitableSession
            data={sessionHighlights?.mostProfitable ?? null}
          />
        </Cell>
        <Cell isTopRow>
          <StatsBiggestLetdown
            data={sessionHighlights?.biggestLetdown ?? null}
          />
        </Cell>
        <Cell isTopRow>
          <StatsLongestSession
            data={sessionHighlights?.longestSession ?? null}
          />
        </Cell>
        <Cell isTopRow isLastCol>
          <StatsMostDecksOpened
            data={sessionHighlights?.mostDecksOpened ?? null}
          />
        </Cell>

        {/* ── Row 2 — Averages ───────────────────────────────────────── */}
        <Cell>
          <StatsAvgDecksPerSession averages={averages} />
        </Cell>
        <Cell>
          <StatsAvgProfitPerSession averages={averages} />
        </Cell>
        <Cell>
          <StatsLuckyBreak data={sessionHighlights?.luckyBreak ?? null} />
        </Cell>
        {isLeague ? (
          <>
            <Cell>
              <StatsAvgSessionDuration averages={averages} />
            </Cell>
            <Cell isLastCol>
              <StatsUniqueCardsCollected
                collectedCount={uniqueCardCount}
                totalAvailable={stackedDeckCardCount ?? null}
              />
            </Cell>
          </>
        ) : (
          <>
            <Cell>
              <StatsAvgSessionDuration averages={averages} />
            </Cell>
            {/* Empty cell to fill the 5th column */}
            <Cell isLastCol>
              <div className="stat opacity-0 pointer-events-none select-none" />
            </Cell>
          </>
        )}
      </div>
    </div>
  );
};
