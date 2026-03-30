import { useEffect, useMemo, useRef } from "react";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import type { SimpleCardEntry } from "~/types/data-stores";

import {
  StatisticsActions,
  StatisticsCharts,
  StatisticsStats,
  StatisticsTable,
} from "../Statistics.components";
import type { CardEntry } from "../Statistics.types";

const StatisticsPage = () => {
  const {
    statistics: {
      statScope,
      selectedLeague,
      setSelectedLeague,
      setStatScope,
      divinationCardStats: stats,
      isDivinationCardsLoading: loading,
      availableLeagues,
      fetchDivinationCards,
      fetchAvailableLeagues,
    },
    settings: { getActiveGameViewSelectedLeague },
  } = useBoundStore();

  // On first mount, seed the statistics-local league selection from the
  // global AppMenu league.  This runs exactly once so that subsequent
  // scope/league changes within the statistics page stay independent of
  // the global selector.
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (hasSeeded.current) return;
    hasSeeded.current = true;

    // If the route loader already seeded the scope to "league" (by reading
    // the global league and calling setStatScope/setSelectedLeague before
    // the component mounted), skip re-seeding to avoid overwriting the
    // loader's league-fallback correction with the raw global value.
    if (statScope === "league") return;

    const globalLeague = getActiveGameViewSelectedLeague();
    if (globalLeague) {
      setSelectedLeague(globalLeague);
      setStatScope("league");
    }
  }, [
    getActiveGameViewSelectedLeague,
    setSelectedLeague,
    setStatScope,
    statScope,
  ]);

  // Fetch divination card stats whenever scope or league changes
  useEffect(() => {
    const league =
      statScope === "league" && selectedLeague ? selectedLeague : undefined;
    fetchDivinationCards("poe1", statScope, league);
  }, [statScope, selectedLeague, fetchDivinationCards]);

  // Fetch available leagues on mount
  useEffect(() => {
    fetchAvailableLeagues("poe1");
  }, [fetchAvailableLeagues]);

  // When the available leagues arrive and the current selectedLeague isn't
  // among them (e.g. a stale league name from a previous challenge), fall
  // back to the first available league.
  useEffect(() => {
    if (
      statScope === "league" &&
      availableLeagues.length > 0 &&
      !availableLeagues.includes(selectedLeague)
    ) {
      setSelectedLeague(availableLeagues[0]);
    }
  }, [availableLeagues, selectedLeague, setSelectedLeague, statScope]);

  const currentScope =
    statScope === "league" && selectedLeague ? selectedLeague : "all-time";

  const cards: Record<string, SimpleCardEntry> = useMemo(() => {
    if (!stats) return {};

    // The Statistics page only uses "all-time" / "league" scopes, which
    // return SimpleDivinationCardStats (cards is Record<string, SimpleCardEntry>).
    // Guard at runtime in case the wrong variant is ever returned.
    return Array.isArray(stats.cards)
      ? {} // defensive fallback — session scope shouldn't reach this page
      : stats.cards;
  }, [stats]);

  const cardData: CardEntry[] = useMemo(() => {
    if (!stats) return [];

    return Object.entries(cards)
      .map(([name, entry]) => ({
        name,
        count: entry.count,
        ratio: (entry.count / stats.totalCount) * 100,
        divinationCard: entry.divinationCard,
      }))
      .sort((a, b) => b.count - a.count);
  }, [stats, cards]);

  // True while the main card/stats data is still being fetched.
  // Child components use this to show a loading overlay on top of their
  // content instead of replacing the entire page with a spinner.
  const isDataLoading = loading || !stats;

  return (
    <PageContainer>
      <PageContainer.Header
        title="Statistics"
        subtitle={
          statScope === "all-time"
            ? "All-time divination card statistics"
            : "League-specific statistics"
        }
        actions={
          <StatisticsActions
            availableLeagues={availableLeagues}
            currentScope={currentScope}
          />
        }
      />
      <PageContainer.Content className="!overflow-hidden flex flex-col gap-4">
        <StatisticsStats
          totalCount={stats?.totalCount ?? 0}
          uniqueCardCount={stats ? Object.keys(cards).length : 0}
          isDataLoading={isDataLoading}
        />
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="w-[420px] shrink-0 flex flex-col min-h-0">
            <StatisticsCharts isDataLoading={isDataLoading} />
          </div>
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <StatisticsTable
              cardData={cardData}
              isDataLoading={isDataLoading}
              currentScope={currentScope}
            />
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default StatisticsPage;
