import { createColumnHelper, type SortingState } from "@tanstack/react-table";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { Table } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import type { DivinationCardMetadata } from "~/types/data-stores";

import type { CardForecastRow } from "../ProfitForecast.slice";
import { formatPercent, formatPnLDivine } from "../ProfitForecast.utils";
import PFCardNameCell from "./PFCardNameCell";

const columnHelper = createColumnHelper<CardForecastRow>();

interface PFTableProps {
  globalFilter: string;
  cardMetadataMap: Map<string, DivinationCardMetadata>;
}

const PFTable = ({ globalFilter, cardMetadataMap }: PFTableProps) => {
  const {
    profitForecast: {
      isComputing,
      isLoading,
      chaosToDivineRatio,
      getFilteredRows,
    },
    poeNinja: { isRefreshing },
  } = useBoundStore();

  const rows = getFilteredRows();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "chanceInBatch", desc: true },
  ]);

  const handleSortingChange = (
    updater: SortingState | ((prev: SortingState) => SortingState),
  ) => {
    const next = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(next);
  };

  const columns = useMemo(
    () => [
      // 1. Card Name
      columnHelper.accessor("cardName", {
        id: "cardName",
        header: "Card Name",
        cell: (info) => (
          <PFCardNameCell
            cardName={info.getValue()}
            cardMetadata={cardMetadataMap.get(info.getValue()) ?? null}
          />
        ),
        size: 200,
        minSize: 150,
        meta: { alignStart: true },
        enableGlobalFilter: true,
      }),

      // 2. Price (in divines)
      columnHelper.accessor("divineValue", {
        id: "divineValue",
        header: "Price",
        cell: (info) => {
          const row = info.row.original;
          if (!row.hasPrice)
            return <span className="text-base-content/40">—</span>;
          const isLowConf = row.confidence === 3;
          return (
            <span
              className={clsx(
                "font-mono text-sm inline-flex items-center gap-1",
                isLowConf && "text-base-content/50",
              )}
            >
              {row.divineValue.toFixed(2)} d
              {isLowConf && (
                <FiAlertTriangle className="w-3 h-3 text-warning" />
              )}
            </span>
          );
        },
        size: 100,
        enableGlobalFilter: false,
      }),

      // 3. % Chance
      columnHelper.accessor("chanceInBatch", {
        id: "chanceInBatch",
        header: "% Chance",
        cell: (info) => (
          <span className="font-mono text-sm">
            {formatPercent(info.getValue(), 2)}
          </span>
        ),
        size: 100,
        enableGlobalFilter: false,
      }),

      // 4. P&L (card only) (Column A)
      columnHelper.accessor("plA", {
        id: "plA",
        header: () => (
          <span data-onboarding="pf-pl-card-only">P&L (card only)</span>
        ),
        cell: (info) => {
          const row = info.row.original;
          if (!row.hasPrice)
            return <span className="text-base-content/40">—</span>;
          const value = info.getValue();
          const isLowConf = row.confidence === 3;
          return (
            <span
              className={clsx(
                "font-mono text-sm",
                isLowConf
                  ? "text-base-content/50"
                  : value >= 0
                    ? "text-success"
                    : "text-error",
              )}
            >
              {formatPnLDivine(value, chaosToDivineRatio)}
            </span>
          );
        },
        size: 120,
        enableGlobalFilter: false,
      }),

      // 5. P&L (all drops) (Column B)
      columnHelper.accessor("plB", {
        id: "plB",
        header: () => (
          <span data-onboarding="pf-pl-all-drops">P&L (all drops)</span>
        ),
        cell: (info) => {
          const row = info.row.original;
          if (!row.hasPrice)
            return <span className="text-base-content/40">—</span>;
          const value = info.getValue();
          const isLowConf = row.confidence === 3;
          return (
            <span
              className={clsx(
                "font-mono text-sm",
                isLowConf
                  ? "text-base-content/50"
                  : value >= 0
                    ? "text-success"
                    : "text-error",
              )}
            >
              {formatPnLDivine(value, chaosToDivineRatio)}
            </span>
          );
        },
        size: 120,
        enableGlobalFilter: false,
      }),
    ],
    [chaosToDivineRatio, cardMetadataMap],
  );

  if (rows.length === 0 && !isLoading) {
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
    </div>
  );
};

export default PFTable;
