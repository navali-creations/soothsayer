import { PageContainer } from "~/renderer/components";
import type { Rarity } from "~/types/data-stores";

import HeaderActions from "./HeaderActions";
import HeaderSubtitle from "./HeaderSubtitle";

interface CardDetailsHeaderProps {
  cardName: string;
  rarity: Rarity;
  fromBoss: boolean;
  isDisabled: boolean;
  inPool: boolean;
}

const CardDetailsHeader = ({
  cardName,
  rarity,
  fromBoss,
  isDisabled,
  inPool,
}: CardDetailsHeaderProps) => {
  return (
    <PageContainer.Header
      title={cardName}
      titleClassName="font-fontin"
      subtitle={
        <HeaderSubtitle
          rarity={rarity}
          fromBoss={fromBoss}
          isDisabled={isDisabled}
          inPool={inPool}
        />
      }
      actions={<HeaderActions />}
    />
  );
};

export default CardDetailsHeader;
