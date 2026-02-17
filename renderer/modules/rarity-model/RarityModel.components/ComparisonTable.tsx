import {
  createColumnHelper,
  type SortingFn,
  type SortingState,
} from "@tanstack/react-table";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { FiRefreshCw } from "react-icons/fi";

import { Table } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import type { KnownRarity, Rarity } from "~/types/data-stores";

import type {
  ComparisonRow,
  ParsedRarityModelRarities,
} from "../RarityModelComparison.slice";
import PoeNinjaColumnHeader from "./PoeNinjaColumnHeader";
import PoeNinjaRarityCell from "./PoeNinjaRarityCell";
import RarityBadgeDropdown from "./RarityBadgeDropdown";
import RarityModelCardNameCell from "./RarityModelCardNameCell";

const columnHelper = createColumnHelper<ComparisonRow>();

const PLACEHOLDER_FILTER_NAMES = ["Filter 1", "Filter 2", "Filter 3"];

interface ComparisonTableProps {
  globalFilter?: string;
}

const ComparisonTable = ({ globalFilter }: ComparisonTableProps) => {
  // Priority rarity sort: when a user clicks a rarity badge in the poe.ninja
  // header, cards matching that rarity float to the top.
  const [priorityRarity, setPriorityRarity] = useState<Rarity | null>(null);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);

  const handleRarityClick = useCallback((rarity: Rarity) => {
    setPriorityRarity((prev) => {
      const next = prev === rarity ? null : rarity;
      if (next != null) {
        // Activate sorting on the poe.ninja column
        setSorting([{ id: "poeNinjaRarity", desc: false }]);
      } else {
        // Deselected — go back to sorting by name
        setSorting([{ id: "name", desc: false }]);
      }
      return next;
    });
  }, []);

  const handleSortingChange = useCallback((newSorting: SortingState) => {
    setSorting(newSorting);
    // Clear priority rarity if user sorts by a different column
    const isSortingByRarity = newSorting.some((s) => s.id === "poeNinjaRarity");
    if (!isSortingByRarity) {
      setPriorityRarity(null);
    }
  }, []);

  // Custom sort: matching rarity first, then ascending by rarity value.
  const raritySortFn = useMemo<SortingFn<ComparisonRow>>(
    () => (rowA, rowB) => {
      const a = rowA.original.rarity;
      const b = rowB.original.rarity;

      if (priorityRarity != null) {
        const aMatch = a === priorityRarity ? 0 : 1;
        const bMatch = b === priorityRarity ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }

      return a - b;
    },
    [priorityRarity],
  );

  // Use individual selectors so the component only re-renders when these
  // specific slices of state change, rather than on every store mutation.
  const storeSelectedFilters = useBoundStore(
    (s) => s.rarityModelComparison.selectedFilters,
  );
  const storeParsingFilterId = useBoundStore(
    (s) => s.rarityModelComparison.parsingFilterId,
  );
  const storeParsedResults = useBoundStore(
    (s) => s.rarityModelComparison.parsedResults,
  );
  const showDiffsOnly = useBoundStore(
    (s) => s.rarityModelComparison.showDiffsOnly,
  );

  // Defer the values that drive the expensive displayRows rebuild so React
  // can commit the sidebar / toolbar re-render (cheap) immediately and
  // update the table data in a subsequent background render.
  // Columns use the non-deferred store values directly so that new filter
  // columns (with "Parsing…" headers) appear instantly.
  const selectedFilters = useDeferredValue(storeSelectedFilters);
  const parsedResults = useDeferredValue(storeParsedResults);
  const allCards = useBoundStore((s) => s.cards.allCards);
  const availableFilters = useBoundStore((s) => s.rarityModel.availableFilters);
  const updateFilterCardRarity = useBoundStore(
    (s) => s.rarityModelComparison.updateFilterCardRarity,
  );

  // Memoize display rows so the Table component receives a stable data
  // reference when the actual underlying data hasn't changed.
  // Inlined here (instead of calling the store getter) so that
  // react-hooks/exhaustive-deps can verify the dependency list.
  const displayRows = useMemo(() => {
    // ── Compute differences (filter rarity vs poe.ninja rarity) ──
    const parsed = selectedFilters
      .map((id) => parsedResults.get(id))
      .filter(Boolean) as ParsedRarityModelRarities[];

    const differences = new Set<string>();
    if (parsed.length >= 1) {
      for (const card of allCards) {
        const ninjaRarity = card.rarity;
        for (const p of parsed) {
          const filterRarity = p.rarities.get(card.name) ?? 4;
          if (filterRarity !== ninjaRarity) {
            differences.add(card.name);
            break;
          }
        }
      }
    }

    // ── Filter cards ──
    let filtered = allCards;
    if (showDiffsOnly && differences.size > 0) {
      filtered = filtered.filter((c) => differences.has(c.name));
    }

    // ── Map to ComparisonRow ──
    return filtered.map((card): ComparisonRow => {
      const filterRarities: Record<string, KnownRarity | null> = {};
      for (const filterId of selectedFilters) {
        const p = parsedResults.get(filterId);
        filterRarities[filterId] = p
          ? (p.rarities.get(card.name) ?? (4 as KnownRarity))
          : null;
      }

      return {
        id: card.id,
        name: card.name,
        stackSize: card.stackSize,
        description: card.description,
        rewardHtml: card.rewardHtml,
        artSrc: card.artSrc,
        flavourHtml: card.flavourHtml,
        rarity: card.rarity,
        isDifferent: differences.has(card.name),
        filterRarities,
      };
    });
  }, [allCards, selectedFilters, parsedResults, showDiffsOnly]);

  // Columns use NON-deferred store values so that new filter columns
  // (with "Parsing…" headers) appear on the very first render after the
  // click, while the expensive displayRows computation stays deferred.
  // React.memo on cell components keeps the column-rebuild cheap.
  const columns = useMemo(() => {
    const placeholderCount = Math.max(0, 3 - storeSelectedFilters.length);

    // Compute selected filter details inline so the useMemo doesn't depend
    // on an unstable array reference from getSelectedFilterDetails().
    const selectedFilterDetails = storeSelectedFilters
      .map((id) => availableFilters.find((f) => f.id === id))
      .filter(Boolean);

    return [
      // Card Name — with DivinationCard hover popover
      columnHelper.accessor("name", {
        id: "name",
        header: "Card Name",
        cell: (info) => <RarityModelCardNameCell card={info.row.original} />,
        size: 200,
        minSize: 150,
      }),

      // poe.ninja rarity — sortable by clicking rarity badges in header
      // TODO: Make badge a clickable link to internal card detail page
      columnHelper.accessor("rarity", {
        id: "poeNinjaRarity",
        header: () => (
          <PoeNinjaColumnHeader
            activeRarity={priorityRarity}
            onRarityClick={handleRarityClick}
          />
        ),
        cell: (info) => (
          <PoeNinjaRarityCell
            rarity={info.getValue()}
            cardName={info.row.original.name}
          />
        ),
        size: 120,
        sortingFn: raritySortFn,
        meta: { hideSortIcon: true },
        enableGlobalFilter: false,
      }),

      // Dynamic filter columns — editable
      ...storeSelectedFilters.map((filterId) => {
        const filterDetail = selectedFilterDetails.find(
          (f) => f!.id === filterId,
        );
        const filterName = filterDetail?.name ?? filterId;
        const isOutdated = filterDetail?.isOutdated ?? false;

        const isParsing =
          storeParsingFilterId === filterId &&
          !storeParsedResults.has(filterId);

        return columnHelper.display({
          id: `filter_${filterId}`,
          header: () =>
            isParsing ? (
              <div className="flex items-center justify-center gap-1.5 text-base-content/50">
                <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span className="text-xs">Parsing...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <span className="truncate max-w-30">{filterName}</span>
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

      // Placeholder columns for unselected filter slots
      ...Array.from({ length: placeholderCount }, (_, i) => {
        const placeholderIndex = storeSelectedFilters.length + i;
        const placeholderName =
          PLACEHOLDER_FILTER_NAMES[placeholderIndex] ??
          `Filter ${placeholderIndex + 1}`;

        return columnHelper.display({
          id: `placeholder_${placeholderIndex}`,
          header: () => (
            <div className="flex flex-col items-center gap-0.5">
              <span className="truncate max-w-30 text-base-content/30">
                {placeholderName}
              </span>
            </div>
          ),
          cell: () => (
            <span className="text-base-content/20 text-xs italic">—</span>
          ),
          size: 150,
          enableGlobalFilter: false,
        });
      }),
    ];
  }, [
    storeSelectedFilters,
    availableFilters,
    updateFilterCardRarity,
    storeParsingFilterId,
    storeParsedResults,
    priorityRarity,
    handleRarityClick,
    raritySortFn,
  ]);

  if (displayRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-base-content/50 py-8">
        <p>No cards match your criteria</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto rounded-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-base-100 [&::-webkit-scrollbar-thumb]:bg-base-300 [&::-webkit-scrollbar-thumb]:rounded-full">
      <Table
        data={displayRows}
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
  );
};

export default ComparisonTable;
