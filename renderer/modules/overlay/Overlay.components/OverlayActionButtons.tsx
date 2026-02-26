import { FiLock, FiUnlock, FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

export const OverlayActionButtons = () => {
  const {
    overlay: { isLocked, setLocked, hide, isLeftHalf },
  } = useBoundStore();

  return (
    <div
      className={`flex gap-1 ${isLeftHalf ? "flex-row" : "flex-row-reverse"}`}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <div
        className="tooltip tooltip-bottom tooltip-primary"
        data-tip="Close Overlay"
      >
        <Button variant="ghost" size="xs" square onClick={hide}>
          <FiX />
        </Button>
      </div>
      <div
        className="tooltip tooltip-bottom tooltip-primary"
        data-tip={isLocked ? "Unlock Overlay" : "Lock Overlay"}
      >
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={() => setLocked(!isLocked)}
        >
          {isLocked ? <FiLock /> : <FiUnlock />}
        </Button>
      </div>
    </div>
  );
};
