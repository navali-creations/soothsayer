import { AnimatePresence, motion } from "motion/react";
import { FiPlay } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Button, Flex } from "../../../components";
import { useBoundStore } from "~/renderer/store";

const CurrentSessionActions = () => {
  const {
    currentSession: {
      getIsCurrentSessionActive,
      isLoading,
      startSession,
      stopSession,
    },
    settings: { getActiveGameViewPriceSource, setActiveGameViewPriceSource },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  const priceSource = getActiveGameViewPriceSource();

  const handlePriceSourceChange = async (source: "exchange" | "stash") => {
    await setActiveGameViewPriceSource(source);
  };

  return (
    <Flex className="gap-2 items-center">
      <div data-onboarding="start-session" className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {isActive ? (
            <motion.div
              key="stop"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
            >
              <Button
                variant="ghost"
                onClick={stopSession}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <rect
                    className="
                      stroke-current
                      stroke-3
                      fill-none
                      [stroke-linecap:butt]
                      [stroke-dasharray:42_8]
                      animate-stop-session
                    "
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                    pathLength="100"
                  />
                </svg>
                Stop Session
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="start"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
            >
              <Button
                variant="ghost"
                onClick={startSession}
                disabled={isLoading}
              >
                <FiPlay /> Start Session
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Price Source Toggle */}
      <div
        role="tablist"
        className="tabs tabs-border"
        data-onboarding="current-session-pricing"
      >
        <button
          role="tab"
          className={`tab flex flex-row items-center gap-1 ${priceSource === "exchange" ? "tab-active" : ""}`}
          onClick={() => handlePriceSourceChange("exchange")}
        >
          <GiCardExchange />
          Exchange
        </button>
        <button
          role="tab"
          className={`tab flex flex-row items-center gap-1 ${priceSource === "stash" ? "tab-active" : ""}`}
          onClick={() => handlePriceSourceChange("stash")}
        >
          <GiLockedChest />
          Stash
        </button>
      </div>
    </Flex>
  );
};

export default CurrentSessionActions;
