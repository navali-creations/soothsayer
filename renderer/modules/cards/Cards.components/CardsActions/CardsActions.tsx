import { useCallback, useMemo } from "react";
import { FiRefreshCw } from "react-icons/fi";
import { GiCrownedSkull } from "react-icons/gi";
import { MdBlock } from "react-icons/md";
import { TbCards } from "react-icons/tb";

import {
  type RaritySourceGroup,
  type RaritySourceOption,
  RaritySourceSelect,
  Search,
} from "~/renderer/components";
import { useRaritySourceChange } from "~/renderer/hooks/useRaritySourceChange/useRaritySourceChange";
import { useCards, useRarityInsights, useSettings } from "~/renderer/store";
import { encodeRaritySourceValue } from "~/renderer/utils";

/**
 * Small helper that renders a dataset-driven menu label with a dotted
 * underline and a superscript "?" hint.
 */
const DatasetMenuLabel = ({ label, hint }: { label: string; hint: string }) => (
  <span className="border-b border-dotted border-b-current" title={hint}>
    {label} <sup>?</sup>
  </span>
);

interface CardsActionsProps {
  onFilterChange?: () => void;
}

export const CardsActions = ({ onFilterChange }: CardsActionsProps) => {
  const {
    searchQuery,
    rarityFilter,
    includeBossCards,
    includeDisabledCards,
    showAllCards,
    setSearchQuery,
    setRarityFilter,
    setIncludeBossCards,
    setIncludeDisabledCards,
    setShowAllCards,
    loadCards,
  } = useCards();
  const { raritySource, selectedFilterId } = useSettings();
  const {
    isScanning,
    lastScannedAt,
    scanFilters,
    getLocalFilters,
    getOnlineFilters,
  } = useRarityInsights();
  const handleRaritySourceChange = useRaritySourceChange();

  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  const handleDropdownChange = useCallback(
    async (value: string) => {
      await handleRaritySourceChange(value);
      await loadCards();
      onFilterChange?.();
    },
    [handleRaritySourceChange, loadCards, onFilterChange],
  );

  const dropdownValue = encodeRaritySourceValue(raritySource, selectedFilterId);

  const groups = useMemo<RaritySourceGroup[]>(() => {
    const result: RaritySourceGroup[] = [
      {
        label: "Dataset Driven",
        options: [
          {
            value: "poe.ninja",
            label: "poe.ninja",
            menuLabel: (
              <DatasetMenuLabel
                label="poe.ninja"
                hint="Price based rarity from poe.ninja market data"
              />
            ),
          },
          {
            value: "prohibited-library",
            label: "Prohibited Library",
            menuLabel: (
              <DatasetMenuLabel
                label="Prohibited Library"
                hint="Weight based rarity from community-collected drop data"
              />
            ),
          },
        ],
      },
    ];

    // Build filter options from discovered filters
    const filterOptions: RaritySourceOption[] = [
      ...onlineFilters.map((filter) => ({
        value: `filter:${filter.id}`,
        label: filter.name,
        outdated: filter.isOutdated,
      })),
      ...localFilters.map((filter) => ({
        value: `filter:${filter.id}`,
        label: filter.name,
        outdated: filter.isOutdated,
      })),
    ];

    // Always show the Loot Filters group — with a scan action when
    // filters haven't been scanned yet or need to be rescanned.
    const needsScan = !lastScannedAt && !isScanning;
    result.push({
      label: "Loot Filters",
      options: filterOptions,
      action: needsScan
        ? {
            label: "Scan for filters",
            onClick: scanFilters,
            icon: <FiRefreshCw className="w-3 h-3" />,
          }
        : isScanning
          ? {
              label: "Scanning...",
              onClick: () => {},
              loading: true,
              loadingLabel: "Scanning...",
            }
          : filterOptions.length === 0
            ? {
                label: "Rescan filters",
                onClick: scanFilters,
                icon: <FiRefreshCw className="w-3 h-3" />,
              }
            : undefined,
    });

    return result;
  }, [onlineFilters, localFilters, lastScannedAt, isScanning, scanFilters]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* Rarity Source */}
        <div className="flex items-center gap-1">
          <RaritySourceSelect
            value={dropdownValue}
            onChange={handleDropdownChange}
            groups={groups}
            width="w-50"
          />
        </div>

        {/* Search */}
        <Search
          size="sm"
          placeholder="Search cards..."
          className="flex-1 w-37.5"
          value={searchQuery}
          onChange={setSearchQuery}
        />

        {/* Rarity Filter */}
        <select
          className="select select-sm select-bordered w-37.5"
          value={rarityFilter}
          onChange={(e) => {
            setRarityFilter(
              e.target.value === "all" ? "all" : parseInt(e.target.value, 10),
            );
            onFilterChange?.();
          }}
        >
          <option value="all">All Rarities</option>
          <option value="1">Extremely Rare</option>
          <option value="2">Rare</option>
          <option value="3">Less Common</option>
          <option value="4">Common</option>
        </select>
      </div>

      {/* Pool, boss cards & disabled cards toggles */}
      <div className="flex justify-end gap-4">
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-info w-3.5 h-3.5"
            checked={showAllCards}
            onChange={(e) => {
              setShowAllCards(e.target.checked);
              onFilterChange?.();
            }}
          />
          <span className="label-text text-sm inline-flex items-center gap-1">
            <TbCards className="w-3.5 h-3.5 text-info/70" />
            Show all cards
          </span>
        </label>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-warning w-3.5 h-3.5"
            checked={includeBossCards}
            onChange={(e) => {
              setIncludeBossCards(e.target.checked);
              onFilterChange?.();
            }}
          />
          <span className="label-text text-sm inline-flex items-center gap-1">
            <GiCrownedSkull className="w-3.5 h-3.5 text-warning/70" />
            Include boss cards
          </span>
        </label>
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-error w-3.5 h-3.5"
            checked={includeDisabledCards}
            onChange={(e) => {
              setIncludeDisabledCards(e.target.checked);
              onFilterChange?.();
            }}
          />
          <span className="label-text text-sm inline-flex items-center gap-1">
            <MdBlock className="w-3.5 h-3.5 text-error/70" />
            Include disabled cards
          </span>
        </label>
      </div>
    </div>
  );
};
