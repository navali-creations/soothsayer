import { useMemo } from "react";

import type { CardEntry } from "../../Statistics.types";
import { StatisticsMostCommonCardStat } from "./StatisticsMostCommonCardStat";
import { StatisticsOpenedDecksStat } from "./StatisticsOpenedDecksStat";
import { StatisticsUniqueCardsStat } from "./StatisticsUniqueCardsStat";

interface StatisticsStatsProps {
  totalCount: number;
  uniqueCardCount: number;
  cardData: CardEntry[];
}

export const StatisticsStats = ({
  totalCount,
  uniqueCardCount,
  cardData,
}: StatisticsStatsProps) => {
  const mostCommonCard = useMemo(() => {
    return cardData.length > 0
      ? cardData.reduce((max, card) => (card.count > max.count ? card : max))
      : null;
  }, [cardData]);

  return (
    <div className="flex w-full shadow rounded-box overflow-hidden">
      <StatisticsOpenedDecksStat totalCount={totalCount} />
      <StatisticsUniqueCardsStat uniqueCardCount={uniqueCardCount} />
      <StatisticsMostCommonCardStat
        cardName={mostCommonCard?.name || null}
        count={mostCommonCard?.count || 0}
      />
    </div>
  );
};
