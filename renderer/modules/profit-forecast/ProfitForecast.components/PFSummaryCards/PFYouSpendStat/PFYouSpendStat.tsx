import { Stat } from "~/renderer/components";
import { useProfitForecast } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFYouSpendStat = () => {
  const {
    isLoading,
    chaosToDivineRatio,
    getTotalCost,
    getAvgCostPerDeck,
    hasData,
  } = useProfitForecast();

  const dataAvailable = hasData() && !isLoading;
  const totalCost = dataAvailable ? getTotalCost() : 0;
  const avgCostPerDeck = dataAvailable ? getAvgCostPerDeck() : 0;

  return (
    <Stat>
      <Stat.Title>You Spend</Stat.Title>
      <Stat.Value className="text-lg">
        {dataAvailable ? formatDivine(totalCost, chaosToDivineRatio) : "—"}
      </Stat.Value>
      <Stat.Desc>
        {dataAvailable ? `avg ${avgCostPerDeck.toFixed(2)}c / deck` : null}
      </Stat.Desc>
    </Stat>
  );
};

export default PFYouSpendStat;
