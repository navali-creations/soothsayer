import { FiAlertTriangle, FiCheck, FiRefreshCw } from "react-icons/fi";

import type { DiscoveredFilterDTO } from "~/main/modules/filters/Filter.dto";
import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import { MAX_SELECTED_FILTERS } from "../FilterComparison.slice";

const FilterSelectorGroup = ({
  label,
  filters,
}: {
  label: string;
  filters: DiscoveredFilterDTO[];
}) => {
  const {
    filterComparison: {
      selectedFilters,
      parsedResults,
      parsingFilterId,
      parseErrors,
      toggleFilter,
    },
  } = useBoundStore();

  if (filters.length === 0) return null;

  return (
    <div className="space-y-1">
      <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
        {label}
      </span>
      <div className="space-y-1">
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter.id);
          const isParsed = parsedResults.has(filter.id);
          const isCurrentlyParsing = parsingFilterId === filter.id;
          const error = parseErrors.get(filter.id);
          const isDisabled =
            selectedFilters.length >= MAX_SELECTED_FILTERS && !isSelected;

          return (
            <button
              key={filter.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-base-200/50 border border-transparent hover:bg-base-200"
              } ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              onClick={() => toggleFilter(filter.id)}
              disabled={isDisabled}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary"
                checked={isSelected}
                readOnly
              />
              <span className="flex-1 truncate">
                {filter.name}
                {filter.isOutdated && (
                  <span className="text-warning ml-1">(outdated)</span>
                )}
              </span>
              {isCurrentlyParsing && (
                <span className="loading loading-spinner loading-xs text-primary" />
              )}
              {isParsed && !isCurrentlyParsing && (
                <FiCheck className="w-3.5 h-3.5 text-success shrink-0" />
              )}
              {error && !isCurrentlyParsing && (
                <div className="tooltip tooltip-left shrink-0" data-tip={error}>
                  <FiAlertTriangle className="w-3.5 h-3.5 text-error" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const FilterSidebar = () => {
  const {
    filters: {
      availableFilters,
      isScanning,
      getLocalFilters,
      getOnlineFilters,
    },
    filterComparison: { rescan },
  } = useBoundStore();

  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  return (
    <div className="w-64 shrink-0 flex flex-col gap-3 overflow-y-auto pr-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        <Button
          variant="ghost"
          size="xs"
          onClick={rescan}
          disabled={isScanning}
          loading={isScanning}
          className="gap-1"
        >
          {!isScanning && <FiRefreshCw className="w-3 h-3" />}
          Scan
        </Button>
      </div>

      <p className="text-xs text-base-content/50">
        Select up to 3 filters to compare side-by-side.
      </p>

      <FilterSelectorGroup label="Online Filters" filters={onlineFilters} />
      <FilterSelectorGroup label="Local Filters" filters={localFilters} />

      {availableFilters.length === 0 && !isScanning && (
        <div className="flex items-center gap-2 text-warning text-xs p-3 rounded-lg bg-base-200/50">
          <FiAlertTriangle className="w-4 h-4 shrink-0" />
          <span>No filters found. Click Scan to search.</span>
        </div>
      )}

      {isScanning && (
        <div className="flex items-center gap-2 text-xs text-base-content/50 p-3">
          <span className="loading loading-spinner loading-xs" />
          <span>Scanning filters...</span>
        </div>
      )}
    </div>
  );
};

export default FilterSidebar;
