import { PageContainer } from "~/renderer/components";
import type { Rarity } from "~/types/data-stores";

import HeaderActions from "./HeaderActions";
import HeaderSubtitle from "./HeaderSubtitle";

interface CardDetailsHeaderProps {
  cardName: string;
  rarity: Rarity;
  fromBoss: boolean;
}

const CardDetailsHeader = ({
  cardName,
  rarity,
  fromBoss,
}: CardDetailsHeaderProps) => {
  return (
    <PageContainer.Header
      title={cardName}
      titleClassName="font-fontin"
      subtitle={<HeaderSubtitle rarity={rarity} fromBoss={fromBoss} />}
      actions={<HeaderActions />}
    />
  );
};

export default CardDetailsHeader;
