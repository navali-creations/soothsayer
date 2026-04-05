import type { Row, SortingState } from "@tanstack/react-table";
import { useCallback, useMemo, useState } from "react";

import { Table } from "~/renderer/components";
import { usePoeNinja, useProfitForecast } from "~/renderer/store";
import type { DivinationCardMetadata } from "~/types/data-stores";

import type { CardForecastRow } from "../../ProfitForecast.slice/ProfitForecast.slice";
import {
  createPFCardNameColumn,
  createPFChanceColumn,
  createPFExcludeColumn,
  createPFPlAllDropsColumn,
  createPFPlCardOnlyColumn,
  createPFPriceColumn,
  createPFStatusColumn,
} from "./columns";

const CHECKBOX_STYLE = { width: 14, height: 14, padding: 1 } as const;

interface PFTableProps {
  globalFilter: string;
  cardMetadataMap: Map<string, DivinationCardMetadata>;
}

const PFTable = ({ globalFilter, cardMetadataMap }: PFTableProps) => {
  const {
    rows: allStoreRows,
    minPriceThreshold,
    isComputing,
    isLoading,
    getFilteredRows,
    getExcludedCount,
  } = useProfitForecast();
  const { isRefreshing } = usePoeNinja();

  const filteredRows = getFilteredRows();
  const excludedCount = getExcludedCount();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "chanceInBatch", desc: true },
  ]);
  const [hideAnomalous, setHideAnomalous] = useState(false);
  const [hideLowConfidence, setHideLowConfidence] = useState(false);

  // When globalFilter is active, merge in rows that are below the min price
  // threshold but match the search query. These rows get `belowMinPrice: true`
  // so the UI can visually distinguish them from normally-visible rows.
  const mergedRows = useMemo(() => {
    const trimmedFilter = globalFilter.trim().toLowerCase();

    if (!trimmedFilter) {
      // No search active — just use the standard filtered rows (all have belowMinPrice = false already)
      return filteredRows;
    }

    // Collect card names already present in the filtered set for fast lookup
    const filteredNames = new Set(filteredRows.map((r) => r.cardName));

    // Find rows that are below the price threshold but match the search query
    const belowThresholdMatches: CardForecastRow[] = [];
    for (const row of allStoreRows) {
      // Skip rows already in the filtered set
      if (filteredNames.has(row.cardName)) continue;

      // Only consider rows that were excluded by the min price filter
      // (i.e. they have a price but it's below the threshold, or they have no price)
      const excludedByMinPrice =
        !row.hasPrice || row.chaosValue < minPriceThreshold;
      if (!excludedByMinPrice) continue;

      // Check if this row matches the search query
      if (row.cardName.toLowerCase().includes(trimmedFilter)) {
        belowThresholdMatches.push({ ...row, belowMinPrice: true });
      }
    }

    if (belowThresholdMatches.length === 0) {
      return filteredRows;
    }

    return [...filteredRows, ...belowThresholdMatches];
  }, [filteredRows, allStoreRows, globalFilter, minPriceThreshold]);

  const rows = useMemo(() => {
    return mergedRows.filter((row) => {
      if (hideAnomalous && row.isAnomalous) return false;
      if (hideLowConfidence && row.confidence === 3) return false;
      return true;
    });
  }, [mergedRows, hideAnomalous, hideLowConfidence]);

  const handleSortingChange = (
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
  };

  const columns = useMemo(
    () => [
      createPFExcludeColumn(),
      createPFStatusColumn(),
      createPFCardNameColumn(cardMetadataMap),
      createPFPriceColumn(),
      createPFChanceColumn(),
      createPFPlCardOnlyColumn(),
      createPFPlAllDropsColumn(),
    ],
    [cardMetadataMap],
  );

  const hasAnomalous = excludedCount.anomalous > 0;
  const hasLowConfidence = excludedCount.lowConfidence > 0;
  const hasUserOverridden = excludedCount.userOverridden > 0;
  const showFilterBar = hasAnomalous || hasLowConfidence || hasUserOverridden;

  const rowClassName = useCallback((row: Row<CardForecastRow>) => {
    const original = row.original;
    if (original.belowMinPrice) {
      return "opacity-45 hover:opacity-70 hover:bg-base-content/[0.03] transition-all";
    }
    return "hover:bg-base-content/[0.03] transition-colors";
  }, []);

  if (rows.length === 0 && !isLoading && !showFilterBar) {
    return (
      <div className="flex-1 flex items-center justify-center text-base-content/50 py-8">
        <p>No cards match the current filters.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2 relative">
      {/* Computing / refreshing overlay */}
      {(isComputing || isRefreshing) && (
        <div className="absolute inset-0 bg-base-200/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-lg">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}

      {/* Filter toggles for excluded cards */}
      {showFilterBar && (
        <div className="flex items-center justify-end gap-3 shrink-0">
          {hasAnomalous && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                className="checkbox checkbox-error"
                style={CHECKBOX_STYLE}
                checked={hideAnomalous}
                onChange={() => setHideAnomalous((v) => !v)}
              />
              <span className="text-base-content/70">
                Hide anomalous prices{" "}
                <span className="text-error">({excludedCount.anomalous})</span>
              </span>
            </label>
          )}

          {hasLowConfidence && (
            <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                className="checkbox checkbox-warning"
                style={CHECKBOX_STYLE}
                checked={hideLowConfidence}
                onChange={() => setHideLowConfidence((v) => !v)}
              />
              <span className="text-base-content/70">
                Hide low confidence prices{" "}
                <span className="text-warning">
                  ({excludedCount.lowConfidence})
                </span>
              </span>
            </label>
          )}

          {hasUserOverridden && (
            <span className="text-xs text-base-content/50">
              {excludedCount.userOverridden} manually overridden
            </span>
          )}
        </div>
      )}

      {rows.length === 0 && !isLoading ? (
        <div className="flex-1 flex items-center justify-center text-base-content/50 py-8">
          <p>No cards match the current filters.</p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto rounded-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-base-100 [&::-webkit-scrollbar-thumb]:bg-base-300 [&::-webkit-scrollbar-thumb]:rounded-full">
          <Table
            data={rows}
            columns={columns}
            enableSorting={true}
            enablePagination={true}
            pageSize={20}
            hoverable={true}
            stickyHeader={true}
            sorting={sorting}
            onSortingChange={handleSortingChange}
            globalFilter={globalFilter}
            rowClassName={rowClassName}
          />
        </div>
      )}
    </div>
  );
};

export default PFTable;
