import { useEffect, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import ComparisonTable from "../RarityInsights.components/ComparisonTable/ComparisonTable";
import ComparisonToolbar from "../RarityInsights.components/ComparisonToolbar/ComparisonToolbar";
import RarityInsightsHeaderActions from "../RarityInsights.components/RarityInsightsHeaderActions/RarityInsightsHeaderActions";

const RarityInsightsPage = () => {
  const [globalFilter, setGlobalFilter] = useState("");

  const {
    rarityInsights: {
      availableFilters,
      isScanning,
      lastScannedAt,
      scanFilters,
    },
    cards: { isLoading: isLoadingCards, loadCards },
    settings: {
      selectedFilterId,
      getSelectedGame,
      getActiveGameViewSelectedLeague,
    },
    rarityInsightsComparison: {
      selectedFilters,
      toggleFilter,
      reset,
      parsingFilterId,
    },
    poeNinja: { isRefreshing, refreshError, checkRefreshStatus },
  } = useBoundStore();

  const game = getSelectedGame();
  const league = getActiveGameViewSelectedLeague();
  const isParsing = !!parsingFilterId;

  // ─── Seed cooldown & reload cards on mount and when game/league changes ─

  useEffect(() => {
    if (!league) return;
    let cancelled = false;

    (async () => {
      // Fetch refresh status and load cards in parallel — they are independent
      await Promise.all([checkRefreshStatus(game, league), loadCards()]);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [game, league, checkRefreshStatus, loadCards]);

  // ─── Scan filters if none available (once) ─────────────────────────────
  // The `lastScannedAt` guard prevents an infinite loop: without it, on CI
  // (where no real filter files exist) each scan returns empty → the effect
  // re-fires because availableFilters is still empty → infinite loop.

  useEffect(() => {
    if (availableFilters.length === 0 && !isScanning && !lastScannedAt) {
      scanFilters();
    }
  }, [availableFilters.length, isScanning, lastScannedAt, scanFilters]);

  // ─── Pre-select the currently active filter ────────────────────────────

  useEffect(() => {
    if (
      selectedFilterId &&
      !selectedFilters.includes(selectedFilterId) &&
      selectedFilters.length === 0
    ) {
      toggleFilter(selectedFilterId);
    }
  }, [selectedFilterId, selectedFilters, toggleFilter]);

  // ─── Reset comparison state when unmounting ────────────────────────────

  useEffect(() => {
    return () => reset();
  }, [reset]);

  const selectedCount = selectedFilters.length;

  return (
    <PageContainer>
      <PageContainer.Header
        title="Rarity Insights"
        subtitle={
          <span>
            Compare and edit divination card rarities across loot filters
          </span>
        }
        actions={
          <RarityInsightsHeaderActions
            onGlobalFilterChange={setGlobalFilter}
            isParsing={isParsing}
          />
        }
      />
      <PageContainer.Content className="overflow-y-hidden! flex flex-col space-y-3!">
        <div className="alert alert-soft alert-warning shrink-0">
          <FiAlertTriangle className="shrink-0 w-6 h-6" />
          <span>
            Changing a card&apos;s rarity here does not modify the filter files
            themselves. <br />
            This feature allows your stacked deck drop results to reflect your
            custom rarity choices.
          </span>
        </div>

        <div className="card bg-base-200 shadow-xl flex-1 min-h-0 flex flex-col relative">
          {/* Loading overlay while cards are being fetched */}
          {isLoadingCards && (
            <div
              data-testid="cards-loading"
              className="absolute inset-0 z-20 bg-base-200/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-4"
            >
              <span className="loading loading-spinner loading-lg text-primary" />
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-base-content">
                  Loading cards...
                </p>
              </div>
            </div>
          )}

          {/* Loading overlay when refreshing prices */}
          {isRefreshing && (
            <div className="absolute inset-0 z-20 bg-base-200/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center gap-4">
              <span className="loading loading-spinner loading-lg text-primary" />
              <div className="text-center space-y-1">
                <p className="text-lg font-semibold text-base-content">
                  Fetching poe.ninja prices...
                </p>
                <p className="text-sm text-base-content/60">
                  Updating card rarities with the latest pricing data.
                </p>
              </div>
            </div>
          )}

          {/* Error banner for price fetch failures */}
          {refreshError && (
            <div className="alert alert-soft alert-error m-3 mb-0">
              <FiAlertTriangle className="shrink-0 w-5 h-5" />
              <span className="text-sm">
                Failed to fetch latest prices: {refreshError}. Card rarities may
                be outdated.
              </span>
            </div>
          )}

          <div className="card-body flex-1 min-h-0">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="card-title">Cards</h2>
                <p className="text-sm text-base-content/60">
                  {selectedCount > 0
                    ? `Comparing rarities across ${selectedCount} filter${
                        selectedCount !== 1 ? "s" : ""
                      } against other rarity sources`
                    : "Select filters to compare rarities against other rarity sources"}
                </p>
              </div>
              <ComparisonToolbar />
            </div>
            <ComparisonTable globalFilter={globalFilter} />
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default RarityInsightsPage;
