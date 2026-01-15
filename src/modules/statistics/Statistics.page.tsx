import { useEffect, useMemo } from "react";
import { PageContainer } from "../../components";
import { useBoundStore } from "../../store/store";
import { useDivinationCards } from "../../hooks";
import {
  StatisticsActions,
  StatisticsStats,
  StatisticsTable,
} from "./Statistics.components";
import type { CardEntry } from "./Statistics.types";

const StatisticsPage = () => {
  const {
    statistics: { statScope, selectedLeague, setSelectedLeague },
  } = useBoundStore();

  // Use the hook with scope parameter
  const { stats, loading, availableLeagues } = useDivinationCards({
    game: "poe1",
    scope: statScope,
    league: statScope === "league" ? selectedLeague : undefined,
  });

  // Set first available league as default when leagues load (only when in league scope)
  useEffect(() => {
    if (
      statScope === "league" &&
      availableLeagues.length > 0 &&
      !availableLeagues.includes(selectedLeague)
    ) {
      setSelectedLeague(availableLeagues[0]);
    }
  }, [availableLeagues, selectedLeague, setSelectedLeague, statScope]);

  const handleExportCsv = async () => {
    try {
      const result = await window.electron.csv.export();
      if (result.success) {
        // Success handled
      } else if (!result.canceled) {
        alert("Failed to export CSV. Please try again.");
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  const cardData: CardEntry[] = useMemo(() => {
    if (!stats) return [];

    return Object.entries(stats.cards)
      .map(([name, entry]) => {
        return {
          name,
          count: entry.count,
          ratio: (entry.count / stats.totalCount) * 100,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageContainer.Header
        title="Statistics"
        subtitle={
          <>
            {statScope === "all-time"
              ? "All-time divination card statistics"
              : "League-specific statistics"}
            {stats.lastUpdated && (
              <span className="block text-sm text-base-content/50">
                Last updated: {new Date(stats.lastUpdated).toLocaleString()}
              </span>
            )}
          </>
        }
        actions={
          <StatisticsActions
            availableLeagues={availableLeagues}
            onExport={handleExportCsv}
          />
        }
      />
      <PageContainer.Content>
        <StatisticsStats
          totalCount={stats.totalCount}
          uniqueCardCount={Object.keys(stats.cards).length}
          cardData={cardData}
        />
        <StatisticsTable cardData={cardData} />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default StatisticsPage;
