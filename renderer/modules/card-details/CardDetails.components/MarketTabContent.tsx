import CardDetailsDropStats from "./CardDetailsDropStats";
import CardDetailsPriceChart from "./CardDetailsPriceChart";
import CardDetailsPriceSummary from "./CardDetailsPriceSummary";

const MarketTabContent = () => {
  return (
    <div className="space-y-6">
      {/* Price summary (confidence, price changes, full set) */}
      <CardDetailsPriceSummary />

      {/* Price history chart */}
      <CardDetailsPriceChart />

      {/* Drop statistics (probability, EV, luck) — relevant to market context */}
      <CardDetailsDropStats />
    </div>
  );
};

export default MarketTabContent;
