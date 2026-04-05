import { FiTrendingUp } from "react-icons/fi";

import { useCardDetails, useProfitForecast } from "~/renderer/store";

/**
 * EV (Expected Value) contribution section.
 *
 * Shows how much this card contributes to the expected value of
 * opening a single stacked deck, in chaos orbs.
 *
 * Reads `totalWeight` from the `profitForecast` slice, derives
 * `chaosValue` from `priceHistory`, and computes EV via the
 * `cardDetails.getEvContribution` getter.
 */
const EvContributionSection = () => {
  const { priceHistory, getEvContribution } = useCardDetails();
  const { totalWeight } = useProfitForecast();

  // Derive chaos value from price history
  const chaosValue =
    priceHistory?.currentDivineRate && priceHistory?.chaosToDivineRatio
      ? priceHistory.currentDivineRate / priceHistory.chaosToDivineRatio
      : 0;

  const ev = getEvContribution(totalWeight, chaosValue);

  if (ev === null || chaosValue <= 0) return null;

  // Format EV nicely
  const evFormatted =
    ev >= 1 ? ev.toFixed(2) : ev >= 0.01 ? ev.toFixed(4) : ev.toExponential(2);

  return (
    <div className="text-sm">
      <span className="text-base-content/50 flex items-center gap-1">
        <FiTrendingUp className="w-3 h-3" /> EV Contribution
      </span>
      <p className="font-semibold tabular-nums">
        {evFormatted}{" "}
        <span className="text-base-content/40 font-normal">chaos per deck</span>
      </p>
      <p className="text-xs text-base-content/40 mt-0.5">
        How much this card contributes to the expected value of opening a
        stacked deck
      </p>
    </div>
  );
};

export default EvContributionSection;
