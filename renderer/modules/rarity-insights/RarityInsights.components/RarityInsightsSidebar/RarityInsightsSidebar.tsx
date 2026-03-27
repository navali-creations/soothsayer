import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiCheck,
  FiChevronDown,
  FiRefreshCw,
  FiSearch,
} from "react-icons/fi";

import type { DiscoveredRarityInsightsDTO } from "~/main/modules/rarity-insights/RarityInsights.dto";
import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import { MAX_SELECTED_FILTERS } from "../../RarityInsightsComparison.slice/RarityInsightsComparison.slice";

const RarityInsightsSelectorGroup = ({
  label,
  filters,
}: {
  label: string;
  filters: DiscoveredRarityInsightsDTO[];
}) => {
  const {
    rarityInsightsComparison: {
      selectedFilters,
      parsedResults,
      parsingFilterId,
      parseErrors,
      toggleFilter,
    },
  } = useBoundStore();

  if (filters.length === 0) return null;

  return (
    <div className="space-y-1 min-w-44">
      <span className="text-xs font-semibold text-base-content/50 uppercase tracking-wide">
        {label}
      </span>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter.id);
          const isParsed = parsedResults.has(filter.id);
          const isCurrentlyParsing = parsingFilterId === filter.id;
          const error = parseErrors.get(filter.id);
          const isAtMax =
            selectedFilters.length >= MAX_SELECTED_FILTERS && !isSelected;
          const isSilentlyDisabled = !!parsingFilterId;
          const isDisabled = isAtMax || isSilentlyDisabled;

          return (
            <button
              key={filter.id}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                isSelected
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-base-200/50 border border-transparent hover:bg-base-200"
              } ${
                isAtMax ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
              onClick={() => !isDisabled && toggleFilter(filter.id)}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-xs checkbox-primary w-3 h-3 mt-0.5"
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

const RarityInsightsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    rarityInsights: {
      availableFilters,
      isScanning,
      getLocalFilters,
      getOnlineFilters,
    },
    rarityInsightsComparison: { selectedFilters, rescan },
  } = useBoundStore();

  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  const selectedCount = selectedFilters.length;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const hasFilters = availableFilters.length > 0;
  const hasBothGroups = onlineFilters.length > 0 && localFilters.length > 0;

  const handleScan = () => {
    if (!isScanning) {
      rescan();
    }
  };

  return (
    <div
      className="relative"
      ref={dropdownRef}
      data-onboarding="rarity-insights-scan"
    >
      <Button
        data-testid="filters-dropdown-trigger"
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className={clsx("gap-1.5", isOpen && "btn-active")}
      >
        Filters
        {selectedCount > 0 && (
          <span className="badge badge-primary badge-xs">{selectedCount}</span>
        )}
        <FiChevronDown
          className={clsx(
            "w-3.5 h-3.5 transition-transform duration-200",
            isOpen && "rotate-180",
          )}
        />
      </Button>

      {isOpen && (
        <div
          className={clsx(
            "absolute right-0 top-full mt-2 z-50",
            "bg-base-100 border border-base-300 rounded-xl shadow-xl",
            "p-4",
          )}
        >
          {/* ─── Scan Section ──────────────────────────────────────── */}
          <div data-testid="scan-section" className="mb-3">
            {isScanning ? (
              <div
                data-testid="scanning-indicator"
                className="flex items-center gap-2 text-sm text-base-content/70"
              >
                <span className="loading loading-spinner loading-xs text-primary" />
                <span>Scanning...</span>
              </div>
            ) : hasFilters ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-base-content/50">
                  Select up to {MAX_SELECTED_FILTERS} filters
                </span>
                <Button
                  data-testid="rescan-button"
                  variant="ghost"
                  size="xs"
                  onClick={handleScan}
                  className="gap-1"
                >
                  <FiRefreshCw className="w-3 h-3" />
                  Rescan
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <p className="text-sm text-base-content/60 text-center">
                  Scan your PoE filter files to load card rarity data
                </p>
                <Button
                  data-testid="scan-filters-button"
                  variant="primary"
                  size="sm"
                  onClick={handleScan}
                  className="gap-1.5"
                >
                  <FiSearch className="w-3.5 h-3.5" />
                  Scan Filters
                </Button>
              </div>
            )}
          </div>

          {/* ─── Filter Groups ─────────────────────────────────────── */}
          {hasFilters && (
            <div className={clsx("flex", hasBothGroups ? "gap-4" : "")}>
              <RarityInsightsSelectorGroup
                label="Online Filters"
                filters={onlineFilters}
              />
              <RarityInsightsSelectorGroup
                label="Local Filters"
                filters={localFilters}
              />
            </div>
          )}

          {!hasFilters && !isScanning && (
            <div className="flex items-center gap-2 text-warning text-xs p-3 rounded-lg bg-base-200/50">
              <FiAlertTriangle className="w-4 h-4 shrink-0" />
              <span>No filters found. Use Scan Filters above to search.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RarityInsightsDropdown;
