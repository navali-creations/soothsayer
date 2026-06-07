import { Stat } from "~/renderer/components";
import { useProfitForecast } from "~/renderer/store";

const PFBreakEvenStat = () => {
  const {
    isLoading,
    customTotalCost,
    selectedBatch,
    chaosToDivineRatio,
    getBreakEvenRate,
    getEffectiveBaseRate,
    hasData,
  } = useProfitForecast();

  const dataAvailable = hasData() && !isLoading;
  const breakEvenRate = dataAvailable ? getBreakEvenRate() : 0;
  const effectiveBaseRate = getEffectiveBaseRate();
  const hasCustomSpend =
    customTotalCost !== null &&
    customTotalCost > 0 &&
    selectedBatch > 0 &&
    chaosToDivineRatio > 0;
  const spendBasisRate = hasCustomSpend
    ? (selectedBatch * chaosToDivineRatio) / customTotalCost
    : null;
  const ratesToCompare =
    spendBasisRate !== null
      ? [effectiveBaseRate, spendBasisRate]
      : [effectiveBaseRate];
  const breakEvenIsGood =
    ratesToCompare.every((rate) => rate > breakEvenRate) && breakEvenRate > 0;
  const description =
    dataAvailable && breakEvenRate > 0 && spendBasisRate === null
      ? `need \u2265 ${Math.ceil(breakEvenRate)} to break even`
      : null;

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
      <Stat.Desc>{description}</Stat.Desc>
    </Stat>
  );
};

export default PFBreakEvenStat;
