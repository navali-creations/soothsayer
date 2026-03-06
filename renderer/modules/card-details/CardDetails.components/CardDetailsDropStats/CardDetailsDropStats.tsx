import { useBoundStore } from "~/renderer/store";

import DropProbabilitySection from "./DropProbabilitySection";
import EvContributionSection from "./EvContributionSection";
import YourLuckSection from "./YourLuckSection";

/**
 * Drop statistics panel for the card details page.
 *
 * Displays three data points that depend on Prohibited Library weight data
 * and personal analytics:
 *
 * 1. **Drop Probability & Expected Decks** — "1 in X stacked decks"
 * 2. **EV Contribution** — How much this card contributes to expected value per deck
 * 3. **"Your Luck" Comparison** — Actual vs. expected drops with luck ratio
 *
 * All sections require PL weight data (weight > 0) to render.
 * EV Contribution additionally requires a chaos value from snapshot prices.
 * "Your Luck" requires personal analytics (drops + total decks opened).
 *
 * No props — reads `totalWeight` from the `profitForecast` slice and
 * all card-specific data from the `cardDetails` slice.
 */
const CardDetailsDropStats = () => {
  const {
    cardDetails: { personalAnalytics },
    profitForecast: { totalWeight },
  } = useBoundStore();

  // Don't render if no personal analytics or no PL data
  if (!personalAnalytics?.prohibitedLibrary) {
    return null;
  }

  const { weight } = personalAnalytics.prohibitedLibrary;

  // Don't render if the card has no weight (boss-exclusive or no data)
  if (weight <= 0 || totalWeight <= 0) {
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
      {personalAnalytics.totalLifetimeDrops > 0 && (
        <div className="border-t border-base-300 pt-3">
          <YourLuckSection />
        </div>
      )}
    </div>
  );
};

export default CardDetailsDropStats;
