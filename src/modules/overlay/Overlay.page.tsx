import { StrictMode, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "../../index.css";
import { GiCardExchange } from "react-icons/gi";
import { motion, AnimatePresence } from "motion/react";
import { useOverlayStore } from "./Overlay.store";
import clsx from "clsx";
import { Beam } from "./Beam";

const OverlayApp = () => {
  const { sessionData, setSessionData } = useOverlayStore();

  useEffect(() => {
    // Fetch initial session data
    window.electron?.overlay.getSessionData().then((data) => {
      if (data) {
        setSessionData(data);
      }
    });

    // Listen for session STATE changes (start/stop)
    const unsubscribeStateChange = window.electron?.session.onStateChanged(
      (update) => {
        if (update.isActive) {
          // Session started - fetch the full data
          window.electron?.overlay.getSessionData().then((data) => {
            if (data) {
              setSessionData(data);
            }
          });
        } else {
          // Session stopped
          setSessionData({
            isActive: false,
            totalCount: 0,
            totalProfit: 0,
            chaosToDivineRatio: 0,
            priceSource: "exchange",
            cards: [],
            recentDrops: [],
          });
        }
      },
    );

    // Listen for session DATA updates (new cards, etc)
    const unsubscribeDataUpdate = window.electron?.session.onDataUpdated(
      (update) => {
        if (update.data) {
          const priceSource = "exchange";
          const totals = update.data.totals?.[priceSource];

          const formattedData = {
            isActive: true,
            totalCount: update.data.totalCount || 0,
            totalProfit: totals?.totalValue || 0,
            chaosToDivineRatio: totals?.chaosToDivineRatio || 0,
            priceSource,
            cards: update.data.cards
              ? update.data.cards.map((card: any) => ({
                  cardName: card.name || card.cardName,
                  count: card.count,
                }))
              : [],
            recentDrops: update.data.recentDrops || [], // Add this
          };

          setSessionData(formattedData);
        }
      },
    );

    return () => {
      unsubscribeStateChange?.();
      unsubscribeDataUpdate?.();
    };
  }, [setSessionData]);

  if (!sessionData.isActive) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-base-300/0 backdrop-blur-sm">
        <div className="text-center p-6">
          <GiCardExchange className="text-6xl mx-auto mb-4 text-base-content/50" />
          <h2 className="text-xl font-bold mb-2">No Active Session</h2>
          <p className="text-sm text-base-content/70">
            Start a session to see live stats
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-base-300/0 backdrop-blur-sm flex flex-col-reverse overflow-hidden">
      {sessionData.recentDrops && sessionData.recentDrops.length > 0 ? (
        <AnimatePresence initial={false} mode="popLayout">
          {sessionData.recentDrops.slice(0, 10).map((drop, index) => {
            const isNew = index === 0;
            const price = drop[`${sessionData.priceSource}Price`];
            const chaosValue = price.chaosValue;
            const rarity = drop.rarity || 4;
            // Determine styling based on rarity
            const getRarityStyles = () => {
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
                case 4: // Common
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

            const rarityStyles = getRarityStyles();

            return (
              <motion.div
                key={`${drop.cardName}-${index}`}
                layout="position"
                initial={isNew ? { x: -110, opacity: 0 } : false}
                animate={{ x: 0, opacity: 1 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{
                  type: "tween",
                  duration: 0.08,
                  ease: "easeOut",
                }}
                className="relative z-20 flex"
              >
                <div className="w-[50px] relative">
                  {rarityStyles.showBeam && (
                    <Beam
                      className="absolute inset-0"
                      color={rarityStyles.beam}
                    />
                  )}
                </div>

                <div
                  className="font-fontin flex-1 flex justify-between text-sm py-0.5 px-1 gap-2"
                  style={{
                    background: rarityStyles.bgGradient,
                    borderWidth: rarityStyles.border ? "1px" : "0",
                    borderStyle: rarityStyles.border ? "solid" : "none",
                    borderColor: rarityStyles.border || "transparent",
                  }}
                >
                  <span
                    className="truncate flex-1"
                    style={{
                      color: rarityStyles.text || "inherit",
                    }}
                  >
                    {drop.cardName}
                  </span>
                  <span className="text-amber-300 shrink-0">
                    {chaosValue > 0 ? `${chaosValue.toFixed(1)}c` : "—"}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      ) : (
        <div className="flex items-center justify-center h-full p-6">
          <div className="text-center">
            <GiCardExchange className="text-4xl mx-auto mb-2 text-base-content/30" />
            <p className="text-xs text-base-content/50">No cards yet</p>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById("overlay-root")!;
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <OverlayApp />
    </StrictMode>,
  );
}
