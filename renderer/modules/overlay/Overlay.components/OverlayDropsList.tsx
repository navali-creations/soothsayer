import { AnimatePresence, motion } from "motion/react";
import { GiCardExchange } from "react-icons/gi";

import { useBoundStore } from "~/renderer/store";
import { getRarityStyles } from "~/renderer/utils";

import { DropBeamColumn } from "./DropBeamColumn";
import { DropContentColumn } from "./DropContentColumn";

export const OverlayDropsList = () => {
  const {
    overlay: { sessionData, getFilteredDrops, activeTab, isLeftHalf },
  } = useBoundStore();

  const filteredDrops = getFilteredDrops() || [];

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
        const rarity = drop.rarity ?? 0;
        const rarityStyles = getRarityStyles(
          rarity,
          isLeftHalf ? "left" : "right",
        );
        const isUnknownRarity = rarity === 0;

        return (
          <motion.div
            key={`${drop.cardName}-${index}`}
            layout="position"
            initial={isNew ? { x: isLeftHalf ? 80 : -80, opacity: 0 } : false}
            animate={{ x: 0, opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: "tween",
              duration: 0.08,
              ease: "easeOut",
            }}
            className={`relative z-20 flex min-w-0 ${
              isLeftHalf ? "flex-row" : "flex-row-reverse"
            }`}
          >
            <DropContentColumn
              cardName={drop.cardName}
              chaosValue={chaosValue}
              rarityStyles={rarityStyles}
            />
            <DropBeamColumn
              showBeam={!!rarityStyles.showBeam}
              beamColor={rarityStyles.beam}
              isUnknownRarity={isUnknownRarity}
            />
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
};
