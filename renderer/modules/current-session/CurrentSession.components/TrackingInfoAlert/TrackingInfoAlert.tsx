import { FiAlertTriangle } from "react-icons/fi";
import { PiMouseLeftClickFill, PiMouseRightClickFill } from "react-icons/pi";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";

const TrackingInfoAlert = () => {
  return (
    <div className="alert alert-soft alert-warning mb-4">
      <FiAlertTriangle className="shrink-0 w-6 h-6" />
      <span>
        Only cards opened in your inventory are tracked. Use{" "}
        <Tooltip content="Right mouse button">
          <PiMouseRightClickFill className="inline w-5 h-5 align-text-bottom" />
        </Tooltip>{" "}
        on the stacked deck or hold <kbd className="kbd kbd-xs">Ctrl</kbd>
        {" + "}
        <Tooltip content="Left mouse button">
          <PiMouseLeftClickFill className="inline w-5 h-5 align-text-bottom" />
        </Tooltip>{" "}
        to open.
      </span>
    </div>
  );
};

export default TrackingInfoAlert;
