import { useCallback, useEffect, useMemo } from "react";
import { GiCrownedSkull } from "react-icons/gi";

import {
  type RaritySourceGroup,
  RaritySourceSelect,
  Search,
} from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import {
  decodeRaritySourceValue,
  encodeRaritySourceValue,
  getAnalyticsRaritySource,
} from "~/renderer/utils";

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
    cards: {
      searchQuery,
      rarityFilter,
      includeBossCards,
      setSearchQuery,
      setRarityFilter,
      setIncludeBossCards,
      loadCards,
    },
    settings: { raritySource, selectedFilterId, updateSetting },
    rarityModel: {
      availableFilters,
      isScanning,
      scanFilters,
      selectFilter,
      clearSelectedFilter,
      getLocalFilters,
      getOnlineFilters,
    },
  } = useBoundStore();

  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  // Lazy scan: if no filters loaded yet, scan on mount
  useEffect(() => {
    if (availableFilters.length === 0 && !isScanning) {
      scanFilters();
    }
  }, [availableFilters.length, isScanning, scanFilters]);

  const handleDropdownChange = useCallback(
    async (value: string) => {
      const { raritySource: newSource, filterId: newFilterId } =
        decodeRaritySourceValue(value);

      // Update rarity source setting
      await updateSetting("raritySource", newSource);
      trackEvent("settings-change", {
        setting: "raritySource",
        value: getAnalyticsRaritySource(
          newSource,
          newFilterId,
          availableFilters,
        ),
      });

      if (newSource === "filter" && newFilterId) {
        await selectFilter(newFilterId);
        await updateSetting("selectedFilterId", newFilterId);
      } else {
        if (selectedFilterId) {
          await clearSelectedFilter();
          await updateSetting("selectedFilterId", null);
        }
      }

      // Refresh cards list to reflect the new rarity source / filter
      await loadCards();
      onFilterChange?.();
    },
    [
      updateSetting,
      selectFilter,
      clearSelectedFilter,
      selectedFilterId,
      availableFilters,
      loadCards,
      onFilterChange,
    ],
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

    if (onlineFilters.length > 0) {
      result.push({
        label: "Online Filters",
        options: onlineFilters.map((filter) => ({
          value: `filter:${filter.id}`,
          label: filter.name,
          outdated: filter.isOutdated,
        })),
      });
    }

    if (localFilters.length > 0) {
      result.push({
        label: "Local Filters",
        options: localFilters.map((filter) => ({
          value: `filter:${filter.id}`,
          label: filter.name,
          outdated: filter.isOutdated,
        })),
      });
    }

    return result;
  }, [onlineFilters, localFilters]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {/* Rarity Source */}
        <div className="flex items-center gap-1">
          <RaritySourceSelect
            value={dropdownValue}
            onChange={handleDropdownChange}
            groups={groups}
            disabled={isScanning}
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

      {/* Boss cards toggle */}
      <div className="flex justify-end">
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
      </div>
    </div>
  );
};
