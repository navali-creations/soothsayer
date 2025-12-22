import { useMemo } from "react";
import { useBoundStore } from "../../../../store/store";
import { Stat } from "../../../../components";
import { formatCurrency } from "../../../../api/poe-ninja";

const CurrentSessionMostValuableStat = () => {
  const {
    currentSession: { getSession },
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();

  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();
  const cardData = sessionData?.cards || [];
  const hasSnapshot = !!sessionData?.priceSnapshot;

  const mostValuableCard = useMemo(() => {
    if (!hasSnapshot || cardData.length === 0) {
      return null;
    }

    // Find card with highest SINGLE card price (not total value)
    return cardData.reduce((max, card) => {
      const currentPriceInfo =
        priceSource === "stash" ? card.stashPrice : card.exchangePrice;
      const maxPriceInfo =
        priceSource === "stash" ? max.stashPrice : max.exchangePrice;

      const currentPrice = currentPriceInfo?.chaosValue || 0;
      const maxPrice = maxPriceInfo?.chaosValue || 0;

      return currentPrice > maxPrice ? card : max;
    });
  }, [cardData, priceSource, hasSnapshot]);

  const priceInfo =
    priceSource === "stash"
      ? mostValuableCard?.stashPrice
      : mostValuableCard?.exchangePrice;
  const cardPrice = priceInfo?.chaosValue || 0;
  const cardName = mostValuableCard?.name || "—";

  const chaosToDivineRatio =
    priceSource === "stash"
      ? sessionData?.priceSnapshot?.stash?.chaosToDivineRatio || 0
      : sessionData?.priceSnapshot?.exchange?.chaosToDivineRatio || 0;

  return (
    <Stat className="flex-1 basis-1/4 min-w-0">
      <Stat.Title>Most Valuable</Stat.Title>
      <Stat.Value>
        {hasSnapshot && mostValuableCard
          ? formatCurrency(cardPrice, chaosToDivineRatio)
          : "—"}
      </Stat.Value>
      <Stat.Desc className="tabular-nums">
        {hasSnapshot ? cardName : "No pricing data"}
      </Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionMostValuableStat;
