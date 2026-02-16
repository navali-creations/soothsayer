import { useBoundStore } from "~/renderer/store";

const ComparisonToolbar = () => {
  const {
    rarityModelComparison: {
      showDiffsOnly,
      setShowDiffsOnly,
      getCanShowDiffs,
      getAllSelectedParsed,
      getDifferences,
    },
  } = useBoundStore();

  const canShowDiffs = getCanShowDiffs();
  const allSelectedParsed = getAllSelectedParsed();
  const differences = getDifferences();

  return (
    <div className="flex items-center gap-3 flex-wrap">
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
    </div>
  );
};

export default ComparisonToolbar;
