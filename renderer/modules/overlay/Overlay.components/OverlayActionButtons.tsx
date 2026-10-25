import { FiLock, FiUnlock, FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useOverlay } from "~/renderer/store";

export const OverlayActionButtons = () => {
  const { isLocked, setLocked, hide, isLeftHalf } = useOverlay();

  return (
    <div
      className={`flex gap-1 ${isLeftHalf ? "flex-row" : "flex-row-reverse"}`}
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <Tooltip as="div" content="Close Overlay" describeChild>
        <Button variant="ghost" size="xs" square onClick={hide}>
          <FiX />
        </Button>
      </Tooltip>
      <Tooltip
        as="div"
        content={isLocked ? "Unlock Overlay" : "Lock Overlay"}
        describeChild
      >
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={() => setLocked(!isLocked)}
        >
          {isLocked ? <FiLock /> : <FiUnlock />}
        </Button>
      </Tooltip>
    </div>
  );
};
