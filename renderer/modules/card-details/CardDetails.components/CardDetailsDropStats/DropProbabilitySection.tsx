import { FiActivity, FiTarget } from "react-icons/fi";

import { useCardDetails, useProfitForecast } from "~/renderer/store";

/**
 * Drop probability & expected decks section.
 *
 * Looks up the matching `CardForecastRow` from `profitForecast.rows`
 * by card name and derives drop-chance / expected-decks display values
 * directly from `row.probability`.
 */
const DropProbabilitySection = () => {
  const { personalAnalytics } = useCardDetails();
  const { rows } = useProfitForecast();

  const cardName = personalAnalytics?.cardName;
  const row = rows.find((r) => r.cardName === cardName);

  if (!row || row.probability <= 0) return null;

  const expectedDecks = 1 / row.probability;
  const dropChanceFormatted = `1 in ${Math.round(
    expectedDecks,
  ).toLocaleString()}`;

  const percent = row.probability * 100;
  const percentFormatted =
    percent >= 1
      ? `${percent.toFixed(1)}%`
      : percent >= 0.01
        ? `${percent.toFixed(4)}%`
        : `${percent.toExponential(2)}%`;

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      <div>
        <span className="text-base-content/50 flex items-center gap-1">
          <FiTarget className="w-3 h-3" /> Drop Chance
        </span>
        <p className="font-semibold tabular-nums text-lg">
          {dropChanceFormatted}
        </p>
        <p className="text-xs text-base-content/40 tabular-nums">
          {percentFormatted}
        </p>
      </div>
      <div>
        <span className="text-base-content/50 flex items-center gap-1">
          <FiActivity className="w-3 h-3" /> Expected Decks
        </span>
        <p className="font-semibold tabular-nums">
          {Math.round(expectedDecks).toLocaleString()}
        </p>
        <p className="text-xs text-base-content/40">
          decks to find one on average
        </p>
      </div>
    </div>
  );
};

export default DropProbabilitySection;
