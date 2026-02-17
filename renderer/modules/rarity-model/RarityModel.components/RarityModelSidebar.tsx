import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiCheck, FiChevronDown } from "react-icons/fi";

import type { DiscoveredRarityModelDTO } from "~/main/modules/rarity-model/RarityModel.dto";
import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import { MAX_SELECTED_FILTERS } from "../RarityModelComparison.slice";

const RarityModelSelectorGroup = ({
  label,
  filters,
}: {
  label: string;
  filters: DiscoveredRarityModelDTO[];
}) => {
  const {
    rarityModelComparison: {
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

const RarityModelDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    rarityModel: {
      availableFilters,
      isScanning,
      getLocalFilters,
      getOnlineFilters,
    },
    rarityModelComparison: { selectedFilters },
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

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsOpen((prev) => !prev)}
        className={clsx("gap-1.5", isOpen && "btn-active")}
        disabled={isScanning || !hasFilters}
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
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-base-content/50">
              Select up to {MAX_SELECTED_FILTERS} filters
            </span>
          </div>

          <div className={clsx("flex", hasBothGroups ? "gap-4" : "")}>
            <RarityModelSelectorGroup
              label="Online Filters"
              filters={onlineFilters}
            />
            <RarityModelSelectorGroup
              label="Local Filters"
              filters={localFilters}
            />
          </div>

          {!hasFilters && !isScanning && (
            <div className="flex items-center gap-2 text-warning text-xs p-3 rounded-lg bg-base-200/50">
              <FiAlertTriangle className="w-4 h-4 shrink-0" />
              <span>No filters found. Click Scan to search.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RarityModelDropdown;
