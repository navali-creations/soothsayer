import { useCallback } from "react";

import { useOverlay } from "~/renderer/store";
import { formatCurrency, type getRarityStyles } from "~/renderer/utils";

interface DropContentColumnProps {
  cardName: string;
  chaosValue: number;
  rarityStyles: ReturnType<typeof getRarityStyles>;
}

export const DropContentColumn = ({
  cardName,
  chaosValue,
  rarityStyles,
}: DropContentColumnProps) => {
  const { isLeftHalf, sessionData } = useOverlay();
  const { chaosToDivineRatio } = sessionData;

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      window.electron?.cardDetails?.openCardInMainWindow?.(cardName);
    },
    [cardName],
  );

  return (
    <div
      className={`font-fontin flex-1 flex justify-between-end text-sm py-0.5 px-1 gap-2 min-w-0 ${
        isLeftHalf ? "flex-row-reverse" : "flex-row"
      }`}
      style={{
        background: rarityStyles.bgGradient,
        borderWidth: rarityStyles.border ? "1px" : "0",
        borderStyle: rarityStyles.border ? "solid" : "none",
        borderColor: rarityStyles.border || "transparent",
      }}
    >
      <span
        className={`${
          isLeftHalf ? "text-right" : ""
        } truncate flex-1 min-w-0 cursor-pointer hover:underline hover:brightness-125 transition-all`}
        style={{
          color: rarityStyles.text || "inherit",
        }}
        onClick={handleCardClick}
        title={`View ${cardName} details`}
      >
        {cardName}
      </span>
      <span className="text-amber-300 shrink-0">
        {chaosValue > 0 ? formatCurrency(chaosValue, chaosToDivineRatio) : "—"}
      </span>
    </div>
  );
};
