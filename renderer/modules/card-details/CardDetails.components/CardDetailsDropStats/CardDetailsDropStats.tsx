import { useCardDetails, useProfitForecast } from "~/renderer/store";

import DropProbabilitySection from "./DropProbabilitySection";
import EvContributionSection from "./EvContributionSection";
import YourLuckSection from "./YourLuckSection";

/**
 * Drop statistics panel for the card details page.
 *
 * Displays three data points that depend on card weight data
 * and personal analytics:
 *
 * 1. **Drop Probability & Expected Decks** — "1 in X stacked decks"
 * 2. **EV Contribution** — How much this card contributes to expected value per deck
 * 3. **"Your Luck" Comparison** — Actual vs. expected drops with luck ratio
 *
 * All sections require a matching row in the profit forecast with probability > 0.
 * EV Contribution additionally requires a chaos value from snapshot prices.
 * "Your Luck" requires personal analytics (drops + total decks opened).
 *
 * No props — looks up the matching `CardForecastRow` from the `profitForecast`
 * slice (via `useProfitForecast().rows`) using the card name from `cardDetails`.
 */
const CardDetailsDropStats = () => {
  const { personalAnalytics } = useCardDetails();
  const { totalWeight, rows } = useProfitForecast();

  const forecastRow = rows.find(
    (r) => r.cardName === personalAnalytics?.cardName,
  );

  // Don't render if no matching forecast row or probability is not positive
  if (!forecastRow || forecastRow.probability <= 0) {
    return null;
  }

  // Don't render if no total weight (profit forecast not loaded)
  if (totalWeight <= 0) {
    return null;
  }

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-4">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Drop Statistics
      </h3>

      {/* Drop probability */}
      <DropProbabilitySection />

      {/* EV contribution (only if price data available) */}
      <div className="border-t border-base-300 pt-3">
        <EvContributionSection />
      </div>

      {/* Your Luck comparison */}
      {personalAnalytics && personalAnalytics.totalLifetimeDrops > 0 && (
        <div className="border-t border-base-300 pt-3">
          <YourLuckSection />
        </div>
      )}
    </div>
  );
};

export default CardDetailsDropStats;
