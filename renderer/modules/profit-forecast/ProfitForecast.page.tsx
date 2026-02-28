import { useEffect, useState } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

import { Button, PageContainer } from "~/renderer/components";
import { useDebounce } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";
import type { DivinationCardMetadata } from "~/types/data-stores";

import PFCostModelPanel from "./ProfitForecast.components/PFCostModelPanel";
import PFHeaderActions from "./ProfitForecast.components/PFHeaderActions";
import PFSummaryCards from "./ProfitForecast.components/PFSummaryCards";
import PFTable from "./ProfitForecast.components/PFTable";
import type { BatchSize } from "./ProfitForecast.slice";

const ProfitForecastPage = () => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [cardMetadataMap, setCardMetadataMap] = useState<
    Map<string, DivinationCardMetadata>
  >(new Map());

  const {
    settings: { getSelectedGame, getActiveGameViewSelectedLeague },
    poeNinja: { isRefreshing, checkRefreshStatus },
    profitForecast: {
      rows,
      snapshotFetchedAt,
      isLoading,
      error,
      selectedBatch,
      stepDrop,
      subBatchSize,
      setSelectedBatch,
      setStepDrop,
      setSubBatchSize,
      setIsComputing,
      fetchData,
      recomputeRows,
      hasData,
    },
  } = useBoundStore();

  const game = getSelectedGame();
  const league = getActiveGameViewSelectedLeague();

  // ─── Seed cooldown status on mount and league change ───────────────────

  useEffect(() => {
    if (!league) return;
    checkRefreshStatus(game, league);
  }, [game, league, checkRefreshStatus]);

  // ─── Fetch forecast data on mount and league change ────────────────────

  useEffect(() => {
    if (!league) return;
    fetchData(game, league);
  }, [game, league, fetchData]);

  // ─── Fetch divination card metadata for popover previews ───────────────

  useEffect(() => {
    if (!hasData() || rows.length === 0) return;

    let cancelled = false;

    const loadMetadata = async () => {
      try {
        const allCards = await window.electron.divinationCards.getAll(
          game as "poe1" | "poe2",
        );

        if (cancelled) return;

        const map = new Map<string, DivinationCardMetadata>();
        for (const card of allCards) {
          map.set(card.name, {
            id: card.id,
            stackSize: card.stackSize,
            description: card.description,
            rewardHtml: card.rewardHtml,
            artSrc: card.artSrc,
            flavourHtml: card.flavourHtml,
            rarity: card.rarity,
            fromBoss: card.fromBoss,
          });
        }
        setCardMetadataMap(map);
      } catch {
        // Non-critical — table still works without card previews
      }
    };

    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [game, rows.length, hasData]);

  // ─── Debounce recomputeRows when cost model or batch changes ───────────

  const debouncedRecompute = useDebounce(
    `${stepDrop}:${subBatchSize}:${selectedBatch}`,
    300,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — debouncedRecompute is the sole trigger; recomputeRows and hasData are stable store references
  useEffect(() => {
    if (!hasData()) return;
    recomputeRows();
  }, [debouncedRecompute]);

  // ─── Slider & batch tab handlers (set isComputing immediately) ─────────

  const handleStepDropChange = (value: number) => {
    setIsComputing(true);
    setStepDrop(value);
  };

  const handleSubBatchSizeChange = (value: number) => {
    setIsComputing(true);
    setSubBatchSize(value);
  };

  const handleBatchChange = (batch: BatchSize) => {
    setIsComputing(true);
    setSelectedBatch(batch);
  };

  // ─── Derived state ─────────────────────────────────────────────────────

  const snapshotIsNull = snapshotFetchedAt === null && !isLoading && !error;
  const plWeightsEmpty = rows.length === 0 && !isLoading && !error;

  return (
    <PageContainer>
      <PageContainer.Header
        title="Profit Forecast"
        subtitle={
          <>
            Projected returns from bulk stacked deck openings.
            <span className="block text-sm text-base-content/50">
              All figures are estimates &mdash; actual results will vary.
            </span>
          </>
        }
        actions={<PFHeaderActions onGlobalFilterChange={setGlobalFilter} />}
      />

      <PageContainer.Content className="overflow-y-hidden! flex flex-col space-y-2!">
        {/* Exchange model disclaimer */}
        <div className="alert alert-soft alert-warning py-2 px-3 text-xs shrink-0">
          <FiAlertTriangle className="shrink-0 w-4 h-4" />
          <span>
            This model assumes listings get more expensive as you buy more
            decks.
            <br />
            We cannot read live exchange order book depth. For large batches,
            check the exchange manually and adjust the sliders to match what you
            actually see.
          </span>
        </div>

        {/* Loading overlay when refreshing prices */}
        {isRefreshing && (
          <div className="alert alert-soft alert-info shrink-0">
            <span className="loading loading-spinner loading-sm" />
            <span>Fetching latest prices from poe.ninja...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="alert alert-soft alert-error shrink-0">
            <FiAlertTriangle className="shrink-0 w-5 h-5" />
            <span>{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => league && fetchData(game, league)}
              className="gap-1.5"
            >
              <FiRefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* No snapshot alert */}
        {snapshotIsNull && !error && (
          <div className="alert alert-soft alert-info shrink-0">
            <FiAlertTriangle className="shrink-0 w-5 h-5" />
            <span>
              No price data for this league yet. Click &ldquo;Refresh
              poe.ninja&rdquo; to load current card prices.
            </span>
          </div>
        )}

        {/* No PL weights hint */}
        {plWeightsEmpty && !snapshotIsNull && (
          <div className="alert alert-soft alert-warning shrink-0">
            <FiAlertTriangle className="shrink-0 w-5 h-5" />
            <span>
              No Prohibited Library data loaded &mdash; visit Settings to
              reload.
            </span>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <span className="loading loading-spinner loading-lg text-primary" />
              <p className="text-base-content/60">
                Loading profit forecast data...
              </p>
            </div>
          </div>
        )}

        {/* Main content — shown when not in initial loading state */}
        {!isLoading && (
          <>
            {/* Stat cards */}
            <div className="relative shrink-0">
              {isRefreshing && (
                <div className="absolute inset-0 bg-base-200/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
                  <span className="loading loading-spinner loading-md text-primary" />
                </div>
              )}
              <PFSummaryCards />
            </div>

            {/* Two-column layout: controls left, table right */}
            <div className="flex gap-3 flex-1 min-h-0">
              {/* Left column — compact exchange model controls */}
              <div className="w-52 shrink-0">
                <PFCostModelPanel
                  selectedBatch={selectedBatch}
                  onBatchChange={handleBatchChange}
                  onStepDropChange={handleStepDropChange}
                  onSubBatchSizeChange={handleSubBatchSizeChange}
                />
              </div>

              {/* Right column — table */}
              <div className="card bg-base-200 shadow-xl flex-1 min-h-0 min-w-0 flex flex-col relative">
                <div className="card-body flex-1 min-h-0 p-3">
                  <PFTable
                    globalFilter={globalFilter}
                    cardMetadataMap={cardMetadataMap}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </PageContainer.Content>
    </PageContainer>
  );
};

export default ProfitForecastPage;
