import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect } from "react";
import { FiSliders } from "react-icons/fi";

import { Button, Search } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import {
  decodeRaritySourceValue,
  encodeRaritySourceValue,
  getAnalyticsRaritySource,
} from "~/renderer/utils";

export const CardsActions = () => {
  const navigate = useNavigate();
  const {
    cards: {
      searchQuery,
      rarityFilter,
      setSearchQuery,
      setRarityFilter,
      loadCards,
    },
    settings: { raritySource, selectedFilterId, updateSetting },
    filters: {
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

  return (
    <div className="flex flex-wrap gap-2">
      {/* Rarity Source */}
      <div className="flex items-center gap-1">
        <select
          className="select select-sm select-bordered w-[180px]"
          value={dropdownValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          disabled={isScanning}
          title="Select rarity source"
        >
          {/* Dataset-driven sources */}
          <optgroup label="Dataset Driven">
            <option value="poe.ninja">poe.ninja (price-based)</option>
            <option value="prohibited-library" disabled>
              Prohibited Library (coming soon)
            </option>
          </optgroup>

          {/* Online filters */}
          {onlineFilters.length > 0 && (
            <optgroup label="Online Filters">
              {onlineFilters.map((filter) => (
                <option key={filter.id} value={`filter:${filter.id}`}>
                  {filter.name}
                  {filter.isOutdated ? " (outdated)" : ""}
                </option>
              ))}
            </optgroup>
          )}

          {/* Local filters */}
          {localFilters.length > 0 && (
            <optgroup label="Local Filters">
              {localFilters.map((filter) => (
                <option key={filter.id} value={`filter:${filter.id}`}>
                  {filter.name}
                  {filter.isOutdated ? " (outdated)" : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Search */}
      <Search
        size="sm"
        placeholder="Search cards..."
        className="flex-1 w-[150px]"
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* Rarity Filter */}
      <select
        className="select select-sm select-bordered w-[150px]"
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

      {/* Modify Rarities */}
      <Button
        variant="ghost"
        size="sm"
        outline
        className="gap-1.5"
        onClick={() => navigate({ to: "/cards/rarities" })}
      >
        <FiSliders className="w-3.5 h-3.5" />
        Modify Rarities
      </Button>
    </div>
  );
};
