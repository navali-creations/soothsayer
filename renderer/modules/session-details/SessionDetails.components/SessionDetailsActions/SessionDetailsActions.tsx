import { FiDownload } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";

import { BackButton, Button, Flex } from "~/renderer/components";
import { useSessionDetails } from "~/renderer/store";

interface SessionDetailsActionsProps {
  onExportCsv?: () => void;
}

const SessionDetailsActions = ({ onExportCsv }: SessionDetailsActionsProps) => {
  const { getPriceSource, setPriceSource } = useSessionDetails();

  const priceSource = getPriceSource();

  return (
    <Flex className="gap-2 items-center">
      <BackButton fallback="/sessions" />

      {/* Price Source Toggle */}
      <div role="tablist" className="tabs tabs-border">
        <button
          role="tab"
          className={`tab flex flex-row items-center gap-1 ${
            priceSource === "exchange" ? "tab-active" : ""
          }`}
          onClick={() => setPriceSource("exchange")}
        >
          <GiCardExchange />
          Exchange
        </button>
        <button
          role="tab"
          className={`tab flex flex-row items-center gap-1 ${
            priceSource === "stash" ? "tab-active" : ""
          }`}
          onClick={() => setPriceSource("stash")}
        >
          <GiLockedChest />
          Stash
        </button>
      </div>

      {onExportCsv && (
        <Button variant="primary" onClick={onExportCsv} size="sm">
          Export CSV <FiDownload />
        </Button>
      )}
    </Flex>
  );
};

export default SessionDetailsActions;
