import { useMemo } from "react";

import { AnimatedNumber, Stat } from "~/renderer/components";
import CardNameLink from "~/renderer/components/CardNameLink/CardNameLink";
import { useBoundStore } from "~/renderer/store";

const CurrentSessionMostValuableStat = () => {
  const sessionData = useBoundStore((state) =>
    state.currentSession.getSession(),
  );

  const cardData = sessionData?.cards || [];
  const hasSnapshot = !!sessionData?.priceSnapshot;

  const mostValuableCard = useMemo(() => {
    if (!hasSnapshot || cardData.length === 0) {
      return null;
    }

    const visibleCards = cardData.filter(
      (card) => card.price && !card.price.hidePrice,
    );

    if (visibleCards.length === 0) {
      return null;
    }

    // Find card with highest SINGLE card price (not total value)
    return visibleCards.reduce((max, card) => {
      const currentPrice = card.price?.chaosValue || 0;
      const maxPrice = max.price?.chaosValue || 0;

      return currentPrice > maxPrice ? card : max;
    });
  }, [cardData, hasSnapshot]);

  const cardPrice = mostValuableCard?.price?.chaosValue || 0;
  const cardName = mostValuableCard?.name || "—";

  const chaosToDivineRatio =
    sessionData?.priceSnapshot?.chaosToDivineRatio || 0;

  return (
    <Stat className="overflow-hidden min-w-0">
      <Stat.Title>Most Valuable</Stat.Title>
      <Stat.Value>
        {hasSnapshot && mostValuableCard ? (
          chaosToDivineRatio > 0 && cardPrice >= chaosToDivineRatio ? (
            <AnimatedNumber
              value={cardPrice / chaosToDivineRatio}
              decimals={2}
              suffix="d"
            />
          ) : (
            <AnimatedNumber value={cardPrice} decimals={2} suffix="c" />
          )
        ) : (
          "—"
        )}
      </Stat.Value>
      <Stat.Desc className="tabular-nums">
        {hasSnapshot && mostValuableCard ? (
          <CardNameLink cardName={cardName} />
        ) : hasSnapshot ? (
          cardName
        ) : (
          "No pricing data"
        )}
      </Stat.Desc>
    </Stat>
  );
};

export default CurrentSessionMostValuableStat;
