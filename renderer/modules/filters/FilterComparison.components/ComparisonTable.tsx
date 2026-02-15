import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import { Table } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import { getRarityStyles, RARITY_LABELS } from "~/renderer/utils";
import type { KnownRarity } from "~/types/data-stores";

import type { ComparisonRow } from "../FilterComparison.slice";
import FilterCardNameCell from "./FilterCardNameCell";
import RarityBadgeDropdown from "./RarityBadgeDropdown";

const columnHelper = createColumnHelper<ComparisonRow>();

interface ComparisonTableProps {
  globalFilter?: string;
}

const ComparisonTable = ({ globalFilter }: ComparisonTableProps) => {
  const {
    filterComparison: {
      selectedFilters,
      getSelectedFilterDetails,
      getDisplayRows,
      updateFilterCardRarity,
    },
  } = useBoundStore();

  const selectedFilterDetails = getSelectedFilterDetails();
  const displayRows = getDisplayRows();

  const columns = useMemo(() => {
    return [
      // Card Name — with DivinationCard hover popover
      columnHelper.accessor("name", {
        id: "name",
        header: "Card Name",
        cell: (info) => <FilterCardNameCell card={info.row.original} />,
        size: 200,
        minSize: 150,
      }),

      // poe.ninja rarity — read-only
      columnHelper.accessor("rarity", {
        id: "poeNinjaRarity",
        header: "poe.ninja",
        cell: (info) => {
          const rarity = info.getValue();
          const styles = getRarityStyles(rarity);
          const label = RARITY_LABELS[rarity] ?? `R${rarity}`;
          return (
            <span className="inline-flex items-center gap-1">
              <span
                className="badge badge-sm whitespace-nowrap"
                style={{
                  backgroundColor: styles.badgeBg,
                  color: styles.badgeText,
                  borderColor: styles.badgeBorder,
                  borderWidth: "1px",
                  borderStyle: "solid",
                }}
              >
                {label}
              </span>
              <div
                className={`tooltip tooltip-right tooltip-warning ${
                  rarity === 0 ? "opacity-100" : "opacity-0"
                }`}
                data-tip="Low confidence or no pricing data from poe.ninja"
              >
                <FiAlertTriangle className="w-3.5 h-3.5 text-warning" />
              </div>
            </span>
          );
        },
        size: 120,
        sortingFn: "basic",
        enableGlobalFilter: false,
      }),

      // Dynamic filter columns — editable
      ...selectedFilters.map((filterId) => {
        const filterDetail = selectedFilterDetails.find(
          (f) => f.id === filterId,
        );
        const filterName = filterDetail?.name ?? filterId;
        const isOutdated = filterDetail?.isOutdated ?? false;

        return columnHelper.display({
          id: `filter_${filterId}`,
          header: () => (
            <div className="flex flex-col items-center gap-0.5">
              <span className="truncate max-w-32">{filterName}</span>
              {isOutdated && (
                <span className="badge badge-warning badge-xs">outdated</span>
              )}
            </div>
          ),
          cell: (info) => {
            const row = info.row.original;
            const filterRarity = row.filterRarities[filterId];

            if (filterRarity === null || filterRarity === undefined) {
              return <span className="loading loading-dots loading-xs" />;
            }

            return (
              <RarityBadgeDropdown
                rarity={filterRarity}
                onRarityChange={(newRarity) =>
                  updateFilterCardRarity(
                    filterId,
                    row.name,
                    newRarity as KnownRarity,
                  )
                }
                outline={filterRarity !== row.rarity}
              />
            );
          },
          size: 150,
          enableGlobalFilter: false,
        });
      }),
    ];
  }, [selectedFilters, selectedFilterDetails, updateFilterCardRarity]);

  if (displayRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-base-content/50 py-8">
        <p>No cards match your criteria</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-lg border border-base-300">
      <Table
        data={displayRows}
        columns={columns}
        enableSorting={true}
        enablePagination={true}
        pageSize={50}
        hoverable={true}
        initialSorting={[{ id: "name", desc: false }]}
        globalFilter={globalFilter}
        rowClassName="hover:bg-base-content/[0.03] transition-colors"
      />
    </div>
  );
};

export default ComparisonTable;
