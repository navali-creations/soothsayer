import { AnimatePresence, motion } from "motion/react";
import { GiCardExchange } from "react-icons/gi";
import { useBoundStore } from "../../../store/store";
import { formatCurrency } from "../../../utils";
import { Beam } from "../Overlay.components";

export const OverlayDropsList = () => {
  const {
    overlay: { sessionData, getFilteredDrops, activeTab },
  } = useBoundStore();

  const filteredDrops = getFilteredDrops() || [];

  const getRarityStyles = (rarity: number) => {
    switch (rarity) {
      case 1: // Extremely rare
        return {
          bgGradient:
            "linear-gradient(to right, rgb(255, 255, 255) 50%, transparent)",
          text: "rgb(0, 0, 255)",
          border: "rgb(0, 0, 255)",
          beam: "orangered",
          showBeam: true,
        };
      case 2: // Rare
        return {
          bgGradient:
            "linear-gradient(to right, rgb(0, 20, 180) 50%, transparent)",
          text: "rgb(255, 255, 255)",
          border: "rgb(255, 255, 255)",
          beam: "yellow",
          showBeam: true,
        };
      case 3: // Less common
        return {
          bgGradient:
            "linear-gradient(to right, rgb(0, 220, 240) 50%, transparent)",
          text: "rgb(0, 0, 0)",
          border: "rgb(0, 0, 0)",
          beam: "",
          showBeam: false,
        };
      default:
        return {
          bgGradient: "",
          text: "",
          border: "",
          beam: "",
          showBeam: false,
        };
    }
  };

  if (filteredDrops.length === 0) {
    const isValuableTab = activeTab === "valuable";
    const hasRecentDrops =
      sessionData.recentDrops && sessionData.recentDrops.length > 0;

    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <GiCardExchange className="text-4xl mx-auto mb-2 text-base-content/30" />
          {isValuableTab && hasRecentDrops ? (
            <>
              <p className="text-sm text-base-content mb-1">
                No valuable cards in recent drops
              </p>
              <p className="text-sm text-base-content/50">
                (Showing last 10 drops)
              </p>
            </>
          ) : (
            <p className="text-xs text-base-content/50">No cards yet</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence initial={false} mode="popLayout">
      {filteredDrops.slice(0, 10).map((drop, index) => {
        const isNew = index === 0;
        const price = drop[`${sessionData.priceSource}Price`];
        const chaosValue = price?.chaosValue || 0;
        const rarity = drop.rarity || 4;
        const rarityStyles = getRarityStyles(rarity);

        return (
          <motion.div
            key={`${drop.cardName}-${index}`}
            layout="position"
            initial={isNew ? { x: -80, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: "tween",
              duration: 0.08,
              ease: "easeOut",
            }}
            className="relative z-20 flex min-w-0"
          >
            <div className="w-[40px] relative shrink-0">
              {rarityStyles.showBeam && (
                <Beam className="absolute inset-0" color={rarityStyles.beam} />
              )}
            </div>

            <div
              className="font-fontin flex-1 flex justify-between text-sm py-0.5 px-1 gap-2 min-w-0"
              style={{
                background: rarityStyles.bgGradient,
                borderWidth: rarityStyles.border ? "1px" : "0",
                borderStyle: rarityStyles.border ? "solid" : "none",
                borderColor: rarityStyles.border || "transparent",
              }}
            >
              <span
                className="truncate flex-1 min-w-0"
                style={{
                  color: rarityStyles.text || "inherit",
                }}
              >
                {drop.cardName}
              </span>
              <span className="text-amber-300 shrink-0">
                {chaosValue > 0
                  ? formatCurrency(chaosValue, sessionData.chaosToDivineRatio)
                  : "—"}
              </span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};
