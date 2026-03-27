import { Stat } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const PFBreakEvenStat = () => {
  const {
    profitForecast: {
      isLoading,
      getBreakEvenRate,
      getEffectiveBaseRate,
      hasData,
    },
  } = useBoundStore();

  const dataAvailable = hasData() && !isLoading;
  const breakEvenRate = dataAvailable ? getBreakEvenRate() : 0;
  const effectiveBaseRate = getEffectiveBaseRate();
  const breakEvenIsGood =
    effectiveBaseRate > breakEvenRate && breakEvenRate > 0;

  return (
    <Stat data-onboarding="pf-break-even-rate">
      <Stat.Title>Break-Even Rate</Stat.Title>
      <Stat.Value
        className={`text-lg ${
          dataAvailable && breakEvenRate > 0
            ? breakEvenIsGood
              ? "text-success"
              : "text-error"
            : ""
        }`}
      >
        {dataAvailable && breakEvenRate > 0
          ? `${Math.ceil(breakEvenRate)} decks/div`
          : "—"}
      </Stat.Value>
      <Stat.Desc>
        {dataAvailable && breakEvenRate > 0
          ? `need \u2265 ${Math.ceil(breakEvenRate)} to break even`
          : null}
      </Stat.Desc>
    </Stat>
  );
};

export default PFBreakEvenStat;
