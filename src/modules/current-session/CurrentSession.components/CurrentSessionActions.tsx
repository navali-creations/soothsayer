import { FiPlay, FiSquare } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Button, Flex } from "../../../components";
import { useBoundStore } from "../../../store/store";

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
    <>
      <Flex className="gap-2 items-center">
        <div data-onboarding="start-session">
          {isActive ? (
            <Button variant="ghost" onClick={stopSession} disabled={isLoading}>
              <FiSquare /> Stop Session
            </Button>
          ) : (
            <Button variant="ghost" onClick={startSession} disabled={isLoading}>
              <FiPlay /> Start Session
            </Button>
          )}
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
    </>
  );
};

export default CurrentSessionActions;
