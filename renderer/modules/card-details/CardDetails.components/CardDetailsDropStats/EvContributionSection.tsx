import { FiTrendingUp } from "react-icons/fi";

import { useCardDetails, useProfitForecast } from "~/renderer/store";

/**
 * EV (Expected Value) contribution section.
 *
 * Shows how much this card contributes to the expected value of
 * opening a single stacked deck, in chaos orbs.
 *
 * Reads `evContribution` directly from the matching `CardForecastRow`
 * in the `profitForecast` slice (already floored, renormalized, and
 * calibrated) instead of computing it via a card-details getter.
 */
const EvContributionSection = () => {
  const { personalAnalytics } = useCardDetails();
  const { rows } = useProfitForecast();

  const cardName = personalAnalytics?.cardName;
  const row = cardName ? rows.find((r) => r.cardName === cardName) : undefined;

  if (!row || row.evContribution <= 0) return null;

  const ev = row.evContribution;

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
