import { useEffect } from "react";

import { useBoundStore } from "~/renderer/store";

import { StatisticsOpenedDecksStat } from "../StatisticsOpenedDecksStat/StatisticsOpenedDecksStat";
import { StatsAvgDecksPerSession } from "../StatsAvgDecksPerSession/StatsAvgDecksPerSession";
import { StatsAvgProfitPerDeck } from "../StatsAvgProfitPerDeck/StatsAvgProfitPerDeck";
import { StatsAvgProfitPerSession } from "../StatsAvgProfitPerSession/StatsAvgProfitPerSession";
import { StatsAvgSessionDuration } from "../StatsAvgSessionDuration/StatsAvgSessionDuration";
import { StatsBiggestLetdown } from "../StatsBiggestLetdown/StatsBiggestLetdown";
import { StatsLongestSession } from "../StatsLongestSession/StatsLongestSession";
import { StatsLuckyBreak } from "../StatsLuckyBreak/StatsLuckyBreak";
import { StatsMostDecksOpened } from "../StatsMostDecksOpened/StatsMostDecksOpened";
import { StatsMostProfitableSession } from "../StatsMostProfitableSession/StatsMostProfitableSession";
import { StatsProfitPerHour } from "../StatsProfitPerHour/StatsProfitPerHour";
import { StatsTotalNetProfit } from "../StatsTotalNetProfit/StatsTotalNetProfit";
import { StatsTotalTimeSpent } from "../StatsTotalTimeSpent/StatsTotalTimeSpent";
import { StatsUniqueCardsCollected } from "../StatsUniqueCardsCollected/StatsUniqueCardsCollected";
import { StatsWinRate } from "../StatsWinRate/StatsWinRate";

interface StatisticsStatsProps {
  totalCount: number;
  uniqueCardCount: number;
  isDataLoading?: boolean;
}

/**
 * Wrapper that places a `.stat` child into a grid cell with the correct
 * border dividers (right border between columns, bottom border when not
 * the last row).
 */
const Cell = ({
  children,
  isLastCol = false,
  isBottomRow = false,
}: {
  children: React.ReactNode;
  isLastCol?: boolean;
  isBottomRow?: boolean;
}) => (
  <div
    className={[
      "h-full [&>.stat]:h-full [&>.stat]:content-start border-dashed border-base-content/10",
      !isLastCol ? "border-r" : "",
      !isBottomRow ? "border-b" : "",
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
      <div
        className={`absolute inset-0 bg-base-200/60 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-lg pointer-events-none transition-opacity duration-200 ${
          isStale ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="loading loading-spinner loading-sm text-primary" />
      </div>

      <div
        className="grid w-full"
        style={{ gridTemplateColumns: "repeat(5, 1fr)" }}
      >
        {/* ── Row 1 — Decks ──────────────────────────────────────────── */}
        <Cell>
          <StatisticsOpenedDecksStat
            totalCount={totalCount}
            sessionCount={averages?.sessionCount ?? null}
          />
        </Cell>
        <Cell>
          <StatsAvgDecksPerSession averages={averages} />
        </Cell>
        <Cell>
          <StatsMostDecksOpened
            data={sessionHighlights?.mostDecksOpened ?? null}
          />
        </Cell>
        <Cell>
          <StatsLongestSession
            data={sessionHighlights?.longestSession ?? null}
          />
        </Cell>
        <Cell isLastCol>
          <StatsAvgSessionDuration averages={averages} />
        </Cell>

        {/* ── Row 2 — Profits ────────────────────────────────────────── */}
        <Cell>
          <StatsTotalNetProfit
            data={sessionHighlights?.totalNetProfit ?? null}
          />
        </Cell>
        <Cell>
          <StatsMostProfitableSession
            data={sessionHighlights?.mostProfitable ?? null}
          />
        </Cell>
        <Cell>
          <StatsAvgProfitPerSession averages={averages} />
        </Cell>
        <Cell>
          <StatsAvgProfitPerDeck
            data={sessionHighlights?.avgProfitPerDeck ?? null}
          />
        </Cell>
        <Cell isLastCol>
          <StatsProfitPerHour data={sessionHighlights?.profitPerHour ?? null} />
        </Cell>

        {/* ── Row 3 — Misc ───────────────────────────────────────────── */}
        {/*
         * When league is selected: WinRate, BiggestLetdown, LuckyBreak, TotalTimeSpent, UniqueCardsCollected = 5 cells.
         * When all-time: WinRate, BiggestLetdown, LuckyBreak, TotalTimeSpent + 1 invisible placeholder = 5 cells.
         */}
        <Cell isBottomRow>
          <StatsWinRate data={sessionHighlights?.winRate ?? null} />
        </Cell>
        <Cell isBottomRow>
          <StatsBiggestLetdown
            data={sessionHighlights?.biggestLetdown ?? null}
          />
        </Cell>
        <Cell isBottomRow>
          <StatsLuckyBreak data={sessionHighlights?.luckyBreak ?? null} />
        </Cell>
        <Cell isBottomRow isLastCol={!isLeague}>
          <StatsTotalTimeSpent
            data={sessionHighlights?.totalTimeSpent ?? null}
          />
        </Cell>
        {isLeague ? (
          <Cell isBottomRow isLastCol>
            <StatsUniqueCardsCollected
              collectedCount={uniqueCardCount}
              totalAvailable={stackedDeckCardCount ?? null}
            />
          </Cell>
        ) : (
          <Cell isLastCol isBottomRow>
            <div className="stat opacity-0 pointer-events-none select-none" />
          </Cell>
        )}
      </div>
    </div>
  );
};
