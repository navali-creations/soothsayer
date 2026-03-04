import type { SortingState } from "@tanstack/react-table";
import { useMemo, useState } from "react";

import { Table } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import type { DivinationCardMetadata } from "~/types/data-stores";

import {
  createPFCardNameColumn,
  createPFChanceColumn,
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
    profitForecast: {
      isComputing,
      isLoading,
      getFilteredRows,
      getExcludedCount,
    },
    poeNinja: { isRefreshing },
  } = useBoundStore();

  const allRows = getFilteredRows();
  const excludedCount = getExcludedCount();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "chanceInBatch", desc: true },
  ]);
  const [hideAnomalous, setHideAnomalous] = useState(false);
  const [hideLowConfidence, setHideLowConfidence] = useState(false);

  const rows = useMemo(() => {
    return allRows.filter((row) => {
      if (hideAnomalous && row.isAnomalous) return false;
      if (hideLowConfidence && row.confidence === 3) return false;
      return true;
    });
  }, [allRows, hideAnomalous, hideLowConfidence]);

  const handleSortingChange = (
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
  };

  const columns = useMemo(
    () => [
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
  const showFilterBar = hasAnomalous || hasLowConfidence;

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
            rowClassName="hover:bg-base-content/[0.03] transition-colors"
          />
        </div>
      )}
    </div>
  );
};

export default PFTable;
