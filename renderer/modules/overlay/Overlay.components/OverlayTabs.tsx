import clsx from "clsx";
import { FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

export const OverlayTabs = () => {
  const {
    overlay: { activeTab, setActiveTab, hide, sessionData },
  } = useBoundStore();

  const isSessionActive = sessionData.isActive;

  return (
    <div className="flex items-center justify-end px-2 h-full bg-gradient-to-r from-transparent to-base-300">
      <div role="tablist" className="tabs tabs-sm tabs-border">
        <div
          className="tooltip tooltip-bottom tooltip-primary"
          data-tip={
            !isSessionActive
              ? "Disabled until active session"
              : "Show all drops"
          }
        >
          <Button
            role="tab"
            variant="ghost"
            size="sm"
            className={clsx("tab", { "tab-active": activeTab === "all" })}
            onClick={() => isSessionActive && setActiveTab("all")}
            disabled={!isSessionActive}
          >
            All
          </Button>
        </div>
        <div
          className="tooltip tooltip-bottom tooltip-primary"
          data-tip={
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
            onClick={() => isSessionActive && setActiveTab("valuable")}
            disabled={!isSessionActive}
          >
            Valuable
          </Button>
        </div>
      </div>

      <div className="flex gap-1">
        {/*<div
          className="tooltip tooltip-bottom"
          data-tip="Settings"
        >*/}
        {/*<Button
            variant="ghost"
            size="xs"
            square
            onClick={() => {

            }}
          >
            <FiSettings />
          </Button>*/}
        {/*</div>*/}
        <div
          className="tooltip tooltip-bottom tooltip-primary -mr-0.5"
          data-tip="Close Overlay"
        >
          <Button variant="ghost" size="xs" square onClick={hide}>
            <FiX />
          </Button>
        </div>
      </div>
    </div>
  );
};
