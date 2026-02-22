import { createColumnHelper, type SortingFn } from "@tanstack/react-table";
import { memo, useDeferredValue, useMemo } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { GiCrownedSkull } from "react-icons/gi";

import { Table } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import { getRarityStyles } from "~/renderer/utils";
import type { KnownRarity } from "~/types/data-stores";

import type {
  ComparisonRow,
  ParsedRarityModelRarities,
} from "../RarityModelComparison.slice";
import PoeNinjaColumnHeader from "./PoeNinjaColumnHeader";
import PoeNinjaRarityCell from "./PoeNinjaRarityCell";
import ProhibitedLibraryColumnHeader from "./ProhibitedLibraryColumnHeader";
import ProhibitedLibraryRarityCell from "./ProhibitedLibraryRarityCell";
import RarityBadgeDropdown from "./RarityBadgeDropdown";
import RarityModelCardNameCell from "./RarityModelCardNameCell";

const columnHelper = createColumnHelper<ComparisonRow>();

const PLACEHOLDER_FILTER_NAMES = ["Filter 1", "Filter 2", "Filter 3"];

const KNOWN_RARITIES: KnownRarity[] = [1, 2, 3, 4];
const SHORT_LABELS: Record<KnownRarity, string> = {
  1: "R1",
  2: "R2",
  3: "R3",
  4: "R4",
};

/**
 * Compact R1–R4 badge row used in filter and placeholder column headers.
 * Supports an optional `disabled` prop to render inert badges for placeholders.
 */
const RarityChips = memo(
  ({
    activeRarity,
    onRarityClick,
    disabled = false,
  }: {
    activeRarity: KnownRarity | null;
    onRarityClick?: (e: React.MouseEvent, rarity: KnownRarity) => void;
    disabled?: boolean;
  }) => (
    <div className="flex items-center gap-0.5">
      {KNOWN_RARITIES.map((rarity) => {
        const styles = getRarityStyles(rarity);
        const isActive = activeRarity === rarity;

        return (
          <button
            key={rarity}
            type="button"
            className="badge badge-xs transition-opacity"
            style={{
              backgroundColor: styles.badgeBg,
              color: styles.badgeText,
              borderColor: styles.badgeBorder,
              borderWidth: "1px",
              borderStyle: "solid",
              opacity: isActive ? 1 : 0.5,
              filter: disabled ? "sepia(1)" : undefined,
              cursor: disabled ? "default" : "pointer",
            }}
            disabled={disabled}
            onClick={disabled ? undefined : (e) => onRarityClick?.(e, rarity)}
            title={disabled ? undefined : `Sort by ${SHORT_LABELS[rarity]}`}
          >
            {SHORT_LABELS[rarity]}
          </button>
        );
      })}
    </div>
  ),
);
RarityChips.displayName = "RarityChips";

interface ComparisonTableProps {
  globalFilter?: string;
}

const ComparisonTable = ({ globalFilter }: ComparisonTableProps) => {
  // ── Priority rarity & sorting — owned by the store ──
  const priorityRarity = useBoundStore(
    (s) => s.rarityModelComparison.priorityPoeNinjaRarity,
  );
  const priorityPLRarity = useBoundStore(
    (s) => s.rarityModelComparison.priorityPlRarity,
  );
  const sorting = useBoundStore((s) => s.rarityModelComparison.tableSorting);
  const handleRarityClick = useBoundStore(
    (s) => s.rarityModelComparison.handlePoeNinjaRarityClick,
  );
  const handlePLRarityClick = useBoundStore(
    (s) => s.rarityModelComparison.handlePlRarityClick,
  );
  const handleFilterRarityClick = useBoundStore(
    (s) => s.rarityModelComparison.handleFilterRarityClick,
  );
  const priorityFilterRarities = useBoundStore(
    (s) => s.rarityModelComparison.priorityFilterRarities,
  );
  const handleSortingChange = useBoundStore(
    (s) => s.rarityModelComparison.handleTableSortingChange,
  );

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

  // Custom sort for PL column: null values always sort to bottom.
  const plRaritySortFn = useMemo<SortingFn<ComparisonRow>>(
    () => (rowA, rowB) => {
      const a = rowA.original.prohibitedLibraryRarity;
      const b = rowB.original.prohibitedLibraryRarity;

      // null (no PL data) always sorts to the bottom
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;

      if (priorityPLRarity != null) {
        const aMatch = a === priorityPLRarity ? 0 : 1;
        const bMatch = b === priorityPLRarity ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
      }

      return a - b;
    },
    [priorityPLRarity],
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
  const includeBossCards = useBoundStore(
    (s) => s.rarityModelComparison.includeBossCards,
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

    // Hide boss-exclusive cards unless explicitly included
    if (!includeBossCards) {
      filtered = filtered.filter((c) => !c.fromBoss);
    }

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
        prohibitedLibraryRarity: card.prohibitedLibraryRarity ?? null,
        fromBoss: card.fromBoss ?? false,
      };
    });
  }, [
    allCards,
    selectedFilters,
    parsedResults,
    showDiffsOnly,
    includeBossCards,
  ]);

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
      // Boss indicator column — only shown when "Include boss cards" is on
      ...(includeBossCards
        ? [
            columnHelper.accessor("fromBoss", {
              id: "fromBoss",
              header: () => (
                <GiCrownedSkull className="w-4 h-4 text-warning/70" />
              ),
              cell: (info) =>
                info.getValue() ? (
                  <GiCrownedSkull className="w-3.5 h-3.5 text-warning/70 mx-auto" />
                ) : null,
              size: 40,
              maxSize: 50,
              enableSorting: false,
              enableGlobalFilter: false,
            }),
          ]
        : []),

      // Card Name — with DivinationCard hover popover
      columnHelper.accessor("name", {
        id: "name",
        header: "Card Name",
        cell: (info) => <RarityModelCardNameCell card={info.row.original} />,
        size: 200,
        minSize: 150,
        meta: { alignStart: true },
      }),

      // poe.ninja rarity — sortable by clicking rarity badges in header
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

      // Prohibited Library rarity — permanent second column, read-only
      columnHelper.accessor("prohibitedLibraryRarity", {
        id: "prohibitedLibraryRarity",
        header: () => (
          <ProhibitedLibraryColumnHeader
            activeRarity={priorityPLRarity}
            onRarityClick={handlePLRarityClick}
          />
        ),
        cell: (info) => (
          <ProhibitedLibraryRarityCell rarity={info.getValue()} />
        ),
        size: 140,
        sortingFn: plRaritySortFn,
        meta: { hideSortIcon: true },
        enableGlobalFilter: false,
      }),

      // Dynamic filter columns — editable, with priority-rarity sorting
      ...storeSelectedFilters.map((filterId) => {
        const filterDetail = selectedFilterDetails.find(
          (f) => f!.id === filterId,
        );
        const filterName = filterDetail?.name ?? filterId;
        const isOutdated = filterDetail?.isOutdated ?? false;

        const isParsing =
          storeParsingFilterId === filterId &&
          !storeParsedResults.has(filterId);

        const filterPriority = priorityFilterRarities[filterId] ?? null;

        const filterSortFn: SortingFn<ComparisonRow> = (rowA, rowB) => {
          const a = rowA.original.filterRarities[filterId];
          const b = rowB.original.filterRarities[filterId];

          // null (still loading) always sorts to the bottom
          if (a == null && b == null) return 0;
          if (a == null) return 1;
          if (b == null) return -1;

          if (filterPriority != null) {
            const aMatch = a === filterPriority ? 0 : 1;
            const bMatch = b === filterPriority ? 0 : 1;
            if (aMatch !== bMatch) return aMatch - bMatch;
          }

          return a - b;
        };

        return columnHelper.accessor(
          (row) => row.filterRarities[filterId] ?? null,
          {
            id: `filter_${filterId}`,
            header: () => (
              <div className="flex flex-col items-center gap-1">
                {isParsing ? (
                  <div className="flex items-center gap-1.5 text-base-content/50">
                    <FiRefreshCw className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Parsing…</span>
                  </div>
                ) : (
                  <>
                    <span className="truncate max-w-30 text-xs font-semibold">
                      {filterName}
                    </span>
                    {isOutdated && (
                      <span className="badge badge-warning badge-xs">
                        outdated
                      </span>
                    )}
                  </>
                )}
                <RarityChips
                  activeRarity={filterPriority}
                  onRarityClick={(e, rarity) => {
                    e.stopPropagation();
                    handleFilterRarityClick(filterId, rarity);
                  }}
                />
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
            sortingFn: filterSortFn,
            meta: { hideSortIcon: true },
            enableGlobalFilter: false,
          },
        );
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
            <div className="flex flex-col items-center gap-1">
              <span className="truncate max-w-30 text-base-content/30 text-xs font-semibold">
                {placeholderName}
              </span>
              <RarityChips activeRarity={null} disabled />
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
    priorityPLRarity,
    handlePLRarityClick,
    plRaritySortFn,
    includeBossCards,
    priorityFilterRarities,
    handleFilterRarityClick,
  ]);

  if (displayRows.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-base-content/50 py-8">
        <p>No cards match your criteria</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
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
    </div>
  );
};

export default ComparisonTable;
