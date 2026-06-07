import { Stat } from "~/renderer/components";
import { useProfitForecast } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFEstimatedNetStat = () => {
  const { isLoading, chaosToDivineRatio, getNetPnL, hasData } =
    useProfitForecast();

  const dataAvailable = hasData() && !isLoading;
  const estimatedNet = dataAvailable ? getNetPnL() : 0;
  const estimatedNetPositive = estimatedNet >= 0;

  return (
    <Stat>
      <Stat.Title>Estimated Net</Stat.Title>
      <Stat.Value
        className={`text-lg ${
          dataAvailable
            ? estimatedNetPositive
              ? "text-success"
              : "text-error"
            : ""
        }`}
      >
        {dataAvailable
          ? `${estimatedNet >= 0 ? "+" : "\u2212"}${formatDivine(
              Math.abs(estimatedNet),
              chaosToDivineRatio,
            )}`
          : "—"}
      </Stat.Value>
      <Stat.Desc>
        <>&nbsp;</>
      </Stat.Desc>
    </Stat>
  );
};

export default PFEstimatedNetStat;
