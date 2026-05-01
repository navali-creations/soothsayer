import { CHART_HEIGHT } from "../constants";

const PriceChartEmpty = () => {
  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Price History
      </h3>
      <div
        className="flex items-center justify-center bg-base-300/30 rounded-lg"
        style={{ height: CHART_HEIGHT }}
      >
        <p className="text-sm text-base-content/50">
          No price history available for this card.
        </p>
      </div>
    </div>
  );
};

export default PriceChartEmpty;
