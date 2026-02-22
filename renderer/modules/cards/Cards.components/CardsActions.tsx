import { useCallback, useEffect, useMemo } from "react";

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

export const CardsActions = () => {
  const {
    cards: {
      searchQuery,
      rarityFilter,
      setSearchQuery,
      setRarityFilter,
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
    },
    [
      updateSetting,
      selectFilter,
      clearSelectedFilter,
      selectedFilterId,
      availableFilters,
      loadCards,
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
    <div className="flex flex-wrap gap-2">
      {/* Rarity Source */}
      <div className="flex items-center gap-1">
        <RaritySourceSelect
          value={dropdownValue}
          onChange={handleDropdownChange}
          groups={groups}
          disabled={isScanning}
          width="w-45"
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
        onChange={(e) =>
          setRarityFilter(
            e.target.value === "all" ? "all" : parseInt(e.target.value, 10),
          )
        }
      >
        <option value="all">All Rarities</option>
        <option value="1">Extremely Rare</option>
        <option value="2">Rare</option>
        <option value="3">Less Common</option>
        <option value="4">Common</option>
      </select>
    </div>
  );
};
