import { Stat } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFEstimatedReturnStat = () => {
  const {
    profitForecast: {
      isLoading,
      evPerDeck,
      chaosToDivineRatio,
      getTotalRevenue,
      hasData,
    },
  } = useBoundStore();

  const dataAvailable = hasData() && !isLoading;
  const totalRevenue = dataAvailable ? getTotalRevenue() : 0;

  return (
    <Stat>
      <Stat.Title>Estimated Return</Stat.Title>
      <Stat.Value className="text-lg">
        {dataAvailable ? formatDivine(totalRevenue, chaosToDivineRatio) : "—"}
      </Stat.Value>
      <Stat.Desc>
        {dataAvailable ? `${evPerDeck.toFixed(2)}c avg value / deck` : null}
      </Stat.Desc>
    </Stat>
  );
};

export default PFEstimatedReturnStat;
