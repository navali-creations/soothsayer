import { useCallback, useEffect } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import {
  decodeRaritySourceValue,
  encodeRaritySourceValue,
  getAnalyticsRaritySource,
} from "~/renderer/utils";

import ProhibitedLibraryStatusBlock from "./ProhibitedLibraryStatusBlock";

const FilterSettingsCard = () => {
  const {
    settings: { raritySource, selectedFilterId, updateSetting },
    rarityModel: {
      availableFilters,
      isScanning,
      isParsing,
      scanError,
      scanFilters,
      selectFilter,
      clearSelectedFilter,
      getLocalFilters,
      getOnlineFilters,
    },
    prohibitedLibrary: { fetchStatus: fetchPlStatus },
  } = useBoundStore();

  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  // Scan filters on mount if none available
  useEffect(() => {
    if (availableFilters.length === 0 && !isScanning) {
      scanFilters();
    }
  }, [availableFilters.length, isScanning, scanFilters]);

  // Fetch PL status on mount so the status block has data
  useEffect(() => {
    fetchPlStatus();
  }, [fetchPlStatus]);

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
        // Select the filter
        await selectFilter(newFilterId);
        await updateSetting("selectedFilterId", newFilterId);
      } else {
        // Clear filter selection when switching to a non-filter source
        if (selectedFilterId) {
          await clearSelectedFilter();
          await updateSetting("selectedFilterId", null);
        }
      }
    },
    [
      updateSetting,
      selectFilter,
      clearSelectedFilter,
      selectedFilterId,
      availableFilters,
    ],
  );

  const handleScan = useCallback(async () => {
    await scanFilters();
    trackEvent("filter-scan");
  }, [scanFilters]);

  const dropdownValue = encodeRaritySourceValue(raritySource, selectedFilterId);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Rarity Source</h2>
        <p className="text-sm text-base-content/60">
          Choose how divination card rarities are determined
        </p>

        <div className="space-y-3 mt-4">
          {/* Unified dropdown + rescan row */}
          <div className="flex items-center gap-2">
            <label className="label shrink-0">
              <span className="label-text">Source</span>
            </label>

            <select
              className="select select-bordered select-sm flex-1 max-h-50"
              value={dropdownValue}
              onChange={(e) => handleDropdownChange(e.target.value)}
              disabled={isParsing}
            >
              {/* ── Dataset-driven sources ── */}
              <optgroup label="Dataset Driven">
                <option value="poe.ninja">poe.ninja (price-based)</option>
                <option value="prohibited-library">
                  Prohibited Library (weight-based)
                </option>
              </optgroup>

              {/* ── Online filters ── */}
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

              {/* ── Local filters ── */}
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

            <Button
              variant="ghost"
              size="sm"
              onClick={handleScan}
              disabled={isScanning}
              loading={isScanning}
              className="gap-1 shrink-0"
              title="Rescan filter directories"
            >
              {!isScanning && <FiRefreshCw className="w-3.5 h-3.5" />}
              Rescan
            </Button>
          </div>

          {/* Scan error */}
          {scanError && <p className="text-xs text-error">{scanError}</p>}

          {/* Prohibited Library status block */}
          {raritySource === "prohibited-library" && (
            <ProhibitedLibraryStatusBlock />
          )}

          {/* No filters found hint */}
          {!isScanning && availableFilters.length === 0 && (
            <div className="flex items-center gap-2 text-warning text-xs">
              <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>
                No filters found. Click "Rescan" to search your PoE filter
                directories.
              </span>
            </div>
          )}

          {/* Filter count */}
          {availableFilters.length > 0 && (
            <span className="text-xs text-base-content/40">
              {availableFilters.length} filter
              {availableFilters.length !== 1 ? "s" : ""} available
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterSettingsCard;
