import { useCallback } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useRaritySourceChange } from "~/renderer/hooks/useRaritySourceChange/useRaritySourceChange";
import { trackEvent } from "~/renderer/modules/umami";
import { useRarityInsights, useSettings } from "~/renderer/store";
import { encodeRaritySourceValue } from "~/renderer/utils";

const FilterSettingsCard = () => {
  const { raritySource, selectedFilterId } = useSettings();
  const {
    availableFilters,
    isScanning,
    isParsing,
    scanError,
    scanFilters,
    getLocalFilters,
    getOnlineFilters,
  } = useRarityInsights();
  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  const handleDropdownChange = useRaritySourceChange();

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
