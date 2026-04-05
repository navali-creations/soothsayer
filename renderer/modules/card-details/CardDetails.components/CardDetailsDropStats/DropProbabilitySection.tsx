import { FiActivity, FiTarget } from "react-icons/fi";

import { useCardDetails, useProfitForecast } from "~/renderer/store";

/**
 * Drop probability & expected decks section.
 *
 * Reads `totalWeight` from the `profitForecast` slice and computes
 * probability via the `cardDetails.getDropProbability` getter.
 */
const DropProbabilitySection = () => {
  const { getDropProbability } = useCardDetails();
  const { totalWeight } = useProfitForecast();

  const prob = getDropProbability(totalWeight);

  if (!prob) return null;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div>
        <span className="text-base-content/50 flex items-center gap-1">
          <FiTarget className="w-3 h-3" /> Drop Chance
        </span>
        <p className="font-semibold tabular-nums text-lg">
          {prob.dropChanceFormatted}
        </p>
        <p className="text-xs text-base-content/40 tabular-nums">
          {prob.percentFormatted}
        </p>
      </div>
      <div>
        <span className="text-base-content/50 flex items-center gap-1">
          <FiActivity className="w-3 h-3" /> Expected Decks
        </span>
        <p className="font-semibold tabular-nums">
          {Math.round(prob.expectedDecks).toLocaleString()}
        </p>
        <p className="text-xs text-base-content/40">
          decks to find one on average
        </p>
      </div>
    </div>
  );
};

export default DropProbabilitySection;
