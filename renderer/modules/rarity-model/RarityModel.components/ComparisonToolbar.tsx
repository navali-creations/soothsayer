import { GiCrownedSkull } from "react-icons/gi";

import { useBoundStore } from "~/renderer/store";

const ComparisonToolbar = () => {
  const {
    rarityModelComparison: {
      showDiffsOnly,
      setShowDiffsOnly,
      includeBossCards,
      setIncludeBossCards,
      getCanShowDiffs,
      getAllSelectedParsed,
      getDifferences,
    },
  } = useBoundStore();

  const canShowDiffs = getCanShowDiffs();
  const allSelectedParsed = getAllSelectedParsed();
  const differences = getDifferences();

  const diffsEnabled = canShowDiffs && allSelectedParsed;

  return (
    <div
      className="flex self-end gap-3 flex-wrap"
      data-onboarding="rarity-model-toolbar"
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
