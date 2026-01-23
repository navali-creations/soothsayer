import { useMemo, useRef } from "react";

import { CardFrame } from "./components/CardFrame";
import { CardArt } from "./components/card-content/CardArt";
import { CardName } from "./components/card-content/CardName";
import { CardRewardFlavour } from "./components/card-content/CardRewardFlavour";
import { CardStackSize } from "./components/card-content/CardStackSize";
import { CARD_EFFECTS } from "./constants";
import { RarityEffects } from "./effects/RarityEffects";
import { useCardMouseEffects } from "./hooks/useCardMouseEffects";
import type { DivinationCardProps } from "./types";
import { processRewardHtml } from "./utils/htmlProcessor";

function DivinationCard({ card }: DivinationCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const { mousePos, isHovered, rotateX, rotateY } =
    useCardMouseEffects(cardRef);

  const processedRewardHtml = useMemo(
    () =>
      card.divinationCard
        ? processRewardHtml(card.divinationCard.rewardHtml)
        : "",
    [card.divinationCard],
  );

  if (!card.divinationCard) {
    return null;
  }

  const { count } = card;
  const { artSrc, stackSize, flavourHtml, rarity } = card.divinationCard;

  const posX = mousePos.x;
  const posY = mousePos.y;

  return (
    <div
      ref={cardRef}
      className="relative w-[320px] h-[476px] transition-transform duration-200 ease-out"
      style={{
        transform: `perspective(${CARD_EFFECTS.PERSPECTIVE}px) rotateX(${isHovered ? rotateX : 0}deg) rotateY(${isHovered ? rotateY : 0}deg)`,
        transformStyle: "preserve-3d",
        willChange: "transform",
        filter:
          "drop-shadow(0 0 2px rgba(255, 255, 255, 0.3)) drop-shadow(0 0 4px rgba(255, 255, 255, 0.2))",
      }}
    >
      <CardFrame />

      <RarityEffects
        rarity={rarity}
        mousePos={mousePos}
        isHovered={isHovered}
        posX={posX}
        posY={posY}
      />

      <CardArt artSrc={artSrc} cardName={card.name} />
      <CardName name={card.name} />
      <CardStackSize count={count} stackSize={stackSize} />
      <CardRewardFlavour
        processedRewardHtml={processedRewardHtml}
        flavourHtml={flavourHtml}
      />
    </div>
  );
}

export default DivinationCard;
