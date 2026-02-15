import { Search } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

interface ComparisonToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
}

const ComparisonToolbar = ({
  searchQuery,
  onSearchQueryChange,
}: ComparisonToolbarProps) => {
  const {
    filterComparison: {
      showDiffsOnly,
      setShowDiffsOnly,
      getCanShowDiffs,
      getAllSelectedParsed,
      getDifferences,
      getDisplayRows,
    },
  } = useBoundStore();

  const canShowDiffs = getCanShowDiffs();
  const allSelectedParsed = getAllSelectedParsed();
  const differences = getDifferences();
  const displayRows = getDisplayRows();

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Search
        value={searchQuery}
        onChange={onSearchQueryChange}
        placeholder="Search cards..."
        size="sm"
        className="w-56"
      />

      {canShowDiffs && allSelectedParsed && (
        <label className="label cursor-pointer gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-xs checkbox-primary"
            checked={showDiffsOnly}
            onChange={(e) => setShowDiffsOnly(e.target.checked)}
          />
          <span className="label-text text-sm">
            Show differences only
            {differences.size > 0 && (
              <span className="text-base-content/50 ml-1">
                ({differences.size})
              </span>
            )}
          </span>
        </label>
      )}

      {!allSelectedParsed && (
        <div className="flex items-center gap-2 text-xs text-base-content/50">
          <span className="loading loading-spinner loading-xs" />
          <span>Parsing filters...</span>
        </div>
      )}

      <span className="text-xs text-base-content/40 ml-auto">
        {displayRows.length} cards
      </span>
    </div>
  );
};

export default ComparisonToolbar;
