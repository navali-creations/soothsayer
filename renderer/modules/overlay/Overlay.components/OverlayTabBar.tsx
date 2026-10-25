import clsx from "clsx";

import { Button } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useOverlay } from "~/renderer/store";

export const OverlayTabBar = () => {
  const { activeTab, setActiveTab, sessionData, isLeftHalf } = useOverlay();

  const isSessionActive = sessionData.isActive;

  const handleAllClick = () => setActiveTab("all");
  const handleValuableClick = () => setActiveTab("valuable");

  return (
    <div
      role="tablist"
      className={`tabs tabs-sm tabs-border ${
        isLeftHalf ? "flex-row-reverse" : "flex-row"
      }`}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <Tooltip
        as="div"
        describeChild
        content={
          !isSessionActive ? "Disabled until active session" : "Show all drops"
        }
      >
        <Button
          role="tab"
          variant="ghost"
          size="sm"
          onClick={handleAllClick}
          disabled={!isSessionActive}
          className={clsx("tab", { "tab-active": activeTab === "all" })}
        >
          All
        </Button>
      </Tooltip>
      <Tooltip
        as="div"
        describeChild
        content={
          !isSessionActive
            ? "Disabled until active session"
            : "Show valuable drops only"
        }
      >
        <Button
          role="tab"
          variant="ghost"
          size="sm"
          className={clsx("tab", { "tab-active": activeTab === "valuable" })}
          onClick={handleValuableClick}
          disabled={!isSessionActive}
        >
          Valuable
        </Button>
      </Tooltip>
    </div>
  );
};
