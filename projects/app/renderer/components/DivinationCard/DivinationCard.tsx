import { useRef, useMemo } from "react";
import type { DivinationCardProps } from "./types";
import { processRewardHtml } from "./utils/htmlProcessor";
import { useCardMouseEffects } from "./hooks/useCardMouseEffects";
import { CardFrame } from "./components/CardFrame";
import { CardArt } from "./components/card-content/CardArt";
import { CardName } from "./components/card-content/CardName";
import { CardStackSize } from "./components/card-content/CardStackSize";
import { CardRewardFlavour } from "./components/card-content/CardRewardFlavour";
import { RarityEffects } from "./effects/RarityEffects";
import { CARD_EFFECTS } from "./constants";

function DivinationCard({ card }: DivinationCardProps) {
  if (!card.divinationCard) {
    return null;
  }

  const { count } = card;
  const { artSrc, stackSize, rewardHtml, flavourHtml, rarity } =
    card.divinationCard;

  const processedRewardHtml = useMemo(
    () => processRewardHtml(rewardHtml),
    [rewardHtml],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const { mousePos, isHovered, rotateX, rotateY } =
    useCardMouseEffects(cardRef);

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
