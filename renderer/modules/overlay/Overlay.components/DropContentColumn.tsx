import { useBoundStore } from "~/renderer/store";
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
  const {
    overlay: {
      isLeftHalf,
      sessionData: { chaosToDivineRatio },
    },
  } = useBoundStore();
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
        className={`${isLeftHalf ? "text-right" : ""} truncate flex-1 min-w-0`}
        style={{
          color: rarityStyles.text || "inherit",
        }}
      >
        {cardName}
      </span>
      <span className="text-amber-300 shrink-0">
        {chaosValue > 0 ? formatCurrency(chaosValue, chaosToDivineRatio) : "—"}
      </span>
    </div>
  );
};
