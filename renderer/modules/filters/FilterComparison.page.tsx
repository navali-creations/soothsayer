import clsx from "clsx";
import { useEffect, useState } from "react";
import { FiAlertTriangle, FiRefreshCw } from "react-icons/fi";

import { Button, PageContainer, Search } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import ComparisonTable from "./FilterComparison.components/ComparisonTable";
import FilterDropdown from "./FilterComparison.components/FilterSidebar";

const FilterComparisonPage = () => {
  const [globalFilter, setGlobalFilter] = useState("");

  const {
    filters: { availableFilters, isScanning, scanFilters },
    cards: { allCards, loadCards },
    settings: { selectedFilterId },
    filterComparison: {
      selectedFilters,
      toggleFilter,
      reset,
      rescan,
      parsingFilterId,
    },
  } = useBoundStore();

  const isParsing = !!parsingFilterId;

  // Load cards on mount if not loaded
  useEffect(() => {
    if (allCards.length === 0) {
      loadCards();
    }
  }, [allCards.length, loadCards]);

  // Scan filters if none available
  useEffect(() => {
    if (availableFilters.length === 0 && !isScanning) {
      scanFilters();
    }
  }, [availableFilters.length, isScanning, scanFilters]);

  // Pre-select the currently active filter
  useEffect(() => {
    if (
      selectedFilterId &&
      !selectedFilters.includes(selectedFilterId) &&
      selectedFilters.length === 0
    ) {
      toggleFilter(selectedFilterId);
    }
  }, [selectedFilterId, selectedFilters, toggleFilter]);

  // Reset comparison state when unmounting
  useEffect(() => {
    return () => reset();
  }, [reset]);

  const selectedCount = selectedFilters.length;

  return (
    <PageContainer>
      <PageContainer.Header
        title="Modify Rarities"
        subtitle={
          <span>
            Compare and edit divination card rarities across loot filters
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Search
              onChange={setGlobalFilter}
              debounceMs={300}
              placeholder="Search cards..."
              size="sm"
              className="w-48"
              disabled={isParsing}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => !isScanning && !isParsing && rescan()}
              disabled={isScanning}
              className="gap-1.5"
            >
              <FiRefreshCw
                className={clsx("w-3.5 h-3.5", {
                  "animate-spin": isScanning,
                })}
              />
              {isScanning ? "Scanning..." : "Scan"}
            </Button>

            <FilterDropdown />
          </div>
        }
      />
      <PageContainer.Content className="overflow-y-hidden! flex flex-col space-y-3!">
        <div className="alert alert-soft alert-warning shrink-0">
          <FiAlertTriangle className="shrink-0 w-6 h-6" />
          <span>
            Changing a card&apos;s rarity here does not modify the filter files
            themselves. <br />
            This feature allows your stacked deck drop results to reflect your
            custom rarity choices.
          </span>
        </div>

        <div className="card bg-base-200 shadow-xl flex-1 min-h-0 flex flex-col">
          <div className="card-body flex-1 min-h-0">
            <div>
              <h2 className="card-title">Cards</h2>
              <p className="text-sm text-base-content/60">
                {selectedCount > 0
                  ? `Comparing rarities across ${selectedCount} filter${
                      selectedCount !== 1 ? "s" : ""
                    } against poe.ninja`
                  : "Select filters to compare rarities against poe.ninja"}
              </p>
            </div>
            <ComparisonTable globalFilter={globalFilter} />
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default FilterComparisonPage;
