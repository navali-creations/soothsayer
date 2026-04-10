import { GiCrownedSkull } from "react-icons/gi";
import { MdBlock } from "react-icons/md";

import { useRarityInsightsComparison } from "~/renderer/store";

const ComparisonToolbar = () => {
  const {
    showDiffsOnly,
    setShowDiffsOnly,
    includeBossCards,
    setIncludeBossCards,
    includeDisabledCards,
    setIncludeDisabledCards,
    getCanShowDiffs,
    getAllSelectedParsed,
    getDifferences,
  } = useRarityInsightsComparison();

  const canShowDiffs = getCanShowDiffs();
  const allSelectedParsed = getAllSelectedParsed();
  const diffsEnabled = canShowDiffs && allSelectedParsed;
  const differences = diffsEnabled ? getDifferences() : new Set<string>();

  return (
    <div
      className="flex self-end gap-3 flex-wrap"
      data-onboarding="rarity-insights-toolbar"
    >
      <label className="label cursor-pointer gap-2">
        <input
          type="checkbox"
          className="checkbox checkbox-xs checkbox-warning"
          checked={includeBossCards}
          onChange={(e) => setIncludeBossCards(e.target.checked)}
        />
        <span className="label-text text-sm inline-flex items-center gap-1">
          <GiCrownedSkull className="w-3.5 h-3.5 text-warning/70" />
          Include boss cards
        </span>
      </label>

      <label className="label cursor-pointer gap-2">
        <input
          type="checkbox"
          className="checkbox checkbox-xs checkbox-error"
          checked={includeDisabledCards}
          onChange={(e) => setIncludeDisabledCards(e.target.checked)}
        />
        <span className="label-text text-sm inline-flex items-center gap-1">
          <MdBlock className="w-3.5 h-3.5 text-error/70" />
          Include disabled cards
        </span>
      </label>

      <label
        className={`label gap-2 ${
          diffsEnabled ? "cursor-pointer" : "cursor-not-allowed opacity-50"
        }`}
      >
        <input
          type="checkbox"
          className="checkbox checkbox-xs checkbox-primary"
          checked={showDiffsOnly}
          disabled={!diffsEnabled}
          onChange={(e) => setShowDiffsOnly(e.target.checked)}
        />
        <span className="label-text text-sm">
          Show differences only
          {diffsEnabled && differences.size > 0 && (
            <span className="text-base-content/50 ml-1">
              ({differences.size})
            </span>
          )}
        </span>
      </label>
    </div>
  );
};

export default ComparisonToolbar;
