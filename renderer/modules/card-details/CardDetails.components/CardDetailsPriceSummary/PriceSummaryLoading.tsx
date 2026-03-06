/**
 * Loading state for the price summary panel.
 * Shown while price data is being fetched.
 */
const PriceSummaryLoading = () => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Price Data
      </h3>
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm" />
        <span className="text-sm text-base-content/50">
          Loading price data…
        </span>
      </div>
    </div>
  );
};

export default PriceSummaryLoading;
