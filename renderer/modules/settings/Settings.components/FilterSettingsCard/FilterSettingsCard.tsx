import { type ChangeEvent, useCallback } from "react";
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

  const handleRaritySourceChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      handleDropdownChange(event.target.value);
    },
    [handleDropdownChange],
  );

  const handleScan = useCallback(async () => {
    await scanFilters();
    trackEvent("filter-scan");
  }, [scanFilters]);

  const dropdownValue = encodeRaritySourceValue(raritySource, selectedFilterId);

  return (
    <section className="space-y-3">
      <div className="space-y-3">
        {/* Unified dropdown + rescan row */}
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium text-base-content/70">
              Rarity Source
            </h3>
            <p className="text-xs text-base-content/50">
              How divination card rarities are determined
            </p>
          </div>

          <div className="join w-full">
            <select
              className="select select-bordered select-sm join-item max-h-50 min-w-0 flex-1"
              value={dropdownValue}
              onChange={handleRaritySourceChange}
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
              variant="primary"
              size="sm"
              onClick={handleScan}
              disabled={isScanning}
              loading={isScanning}
              className="join-item shrink-0 gap-1"
              title="Rescan filter directories"
            >
              {!isScanning && <FiRefreshCw className="w-3.5 h-3.5" />}
              Rescan
            </Button>
          </div>
        </div>

        {/* Scan error */}
        {scanError && <p className="text-xs text-error">{scanError}</p>}

        {/* No filters found hint */}
        {!isScanning && availableFilters.length === 0 && (
          <div className="alert alert-soft alert-warning py-2 text-xs">
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
    </section>
  );
};

export default FilterSettingsCard;
