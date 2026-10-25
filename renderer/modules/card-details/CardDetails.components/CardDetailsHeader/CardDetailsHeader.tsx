import { PageContainer } from "~/renderer/components";
import type { Rarity } from "~/types/data-stores";

import HeaderActions from "./HeaderActions";
import HeaderSubtitle from "./HeaderSubtitle";

interface CardDetailsHeaderProps {
  cardName?: string;
  rarity?: Rarity;
  fromBoss?: boolean;
  isDisabled?: boolean;
  inPool?: boolean;
  animationKey?: string;
}

const CardDetailsHeader = ({
  cardName,
  rarity,
  fromBoss,
  isDisabled,
  inPool,
  animationKey,
}: CardDetailsHeaderProps) => {
  return (
    <PageContainer.Header
      animationKey={animationKey}
      title={cardName ?? "Card Details"}
      titleClassName="font-fontin"
      subtitle={
        cardName && rarity !== undefined ? (
          <HeaderSubtitle
            rarity={rarity}
            fromBoss={fromBoss ?? false}
            isDisabled={isDisabled ?? false}
            inPool={inPool ?? true}
          />
        ) : undefined
      }
      actions={<HeaderActions />}
    />
  );
};

export default CardDetailsHeader;
