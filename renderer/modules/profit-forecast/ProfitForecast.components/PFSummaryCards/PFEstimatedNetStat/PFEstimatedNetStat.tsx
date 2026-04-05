import { Stat } from "~/renderer/components";
import { useProfitForecast } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFEstimatedNetStat = () => {
  const { isLoading, chaosToDivineRatio, getBatchPnL, hasData } =
    useProfitForecast();

  const dataAvailable = hasData() && !isLoading;
  const batchPnL = dataAvailable ? getBatchPnL() : null;

  const estimatedNet = batchPnL?.confidence.estimated ?? 0;
  const estimatedNetPositive = estimatedNet >= 0;

  return (
    <Stat>
      <Stat.Title>Estimated Net</Stat.Title>
      <Stat.Value
        className={`text-lg ${
          dataAvailable && batchPnL
            ? estimatedNetPositive
              ? "text-success"
              : "text-error"
            : ""
        }`}
      >
        {dataAvailable && batchPnL
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
