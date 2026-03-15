import { useNavigate } from "@tanstack/react-router";
import { FiArrowLeft, FiDownload } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";

import { Button, Flex } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

interface SessionDetailsActionsProps {
  onExportCsv?: () => void;
}

const SessionDetailsActions = ({ onExportCsv }: SessionDetailsActionsProps) => {
  const navigate = useNavigate();
  const {
    sessionDetails: { getPriceSource, setPriceSource },
  } = useBoundStore();

  const priceSource = getPriceSource();

  return (
    <Flex className="gap-2 items-center">
      <Button variant="ghost" onClick={() => navigate({ to: "/sessions" })}>
        <FiArrowLeft />
      </Button>

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
