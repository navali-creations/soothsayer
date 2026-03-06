/**
 * No-data state for the price summary panel.
 *
 * Rendered when price history has loaded successfully but no data
 * is available for the current card.
 */
const PriceSummaryEmpty = () => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Price Data
      </h3>
      <p className="text-sm text-base-content/50">
        No price data available for this card.
      </p>
    </div>
  );
};

export default PriceSummaryEmpty;
