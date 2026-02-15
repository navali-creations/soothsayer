import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";

import { Button, PageContainer } from "~/renderer/components";
import { useDebounce } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import ComparisonEmptyState from "./FilterComparison.components/ComparisonEmptyState";
import ComparisonTable from "./FilterComparison.components/ComparisonTable";
import ComparisonToolbar from "./FilterComparison.components/ComparisonToolbar";
import FilterSidebar from "./FilterComparison.components/FilterSidebar";

const FilterComparisonPage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const {
    filters: { availableFilters, isScanning, scanFilters },
    cards: { allCards, loadCards },
    settings: { selectedFilterId },
    filterComparison: {
      selectedFilters,
      toggleFilter,
      parseNextUnparsedFilter,
      reset,
    },
  } = useBoundStore();

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

  // Auto-parse selected filters that haven't been parsed yet.
  // Subscribe to the raw state so the effect re-fires when parsing
  // completes or a new filter is selected.
  const needsParse = useBoundStore((s) =>
    s.filterComparison.selectedFilters.some(
      (id) =>
        !s.filterComparison.parsedResults.has(id) &&
        !s.filterComparison.parsingFilterId &&
        !s.filterComparison.parseErrors.has(id),
    ),
  );

  useEffect(() => {
    if (needsParse) {
      parseNextUnparsedFilter();
    }
  }, [needsParse, parseNextUnparsedFilter]);

  // Reset comparison state when unmounting
  useEffect(() => {
    return () => reset();
  }, [reset]);

  const handleBack = useCallback(() => {
    navigate({ to: "/cards" });
  }, [navigate]);

  const hasSelectedFilters = selectedFilters.length > 0;

  return (
    <PageContainer>
      <PageContainer.Header
        title="Modify Rarities"
        subtitle="Compare and edit divination card rarities across loot filters"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-1.5"
          >
            <FiArrowLeft className="w-4 h-4" />
            Back to Cards
          </Button>
        }
      />
      <PageContainer.Content>
        <div className="flex gap-4 h-full overflow-hidden">
          <FilterSidebar />

          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {!hasSelectedFilters ? (
              <ComparisonEmptyState />
            ) : (
              <>
                <ComparisonToolbar
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                />
                <ComparisonTable globalFilter={debouncedSearchQuery} />
              </>
            )}
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default FilterComparisonPage;
