import { FiAlertTriangle } from "react-icons/fi";
import { PiMouseLeftClickFill, PiMouseRightClickFill } from "react-icons/pi";

const TrackingInfoAlert = () => {
  return (
    <div className="alert alert-soft alert-warning mb-4">
      <FiAlertTriangle className="shrink-0 w-6 h-6" />
      <span>
        Only cards opened in your inventory are tracked. Use{" "}
        <span
          className="tooltip tooltip-bottom tooltip-primary"
          data-tip="Right click"
        >
          <PiMouseRightClickFill className="inline w-5 h-5 align-text-bottom" />
        </span>{" "}
        on the stacked deck or hold <kbd className="kbd kbd-xs">Ctrl</kbd>
        {" + "}
        <span
          className="tooltip tooltip-bottom tooltip-primary"
          data-tip="Left click"
        >
          <PiMouseLeftClickFill className="inline w-5 h-5 align-text-bottom" />
        </span>{" "}
        to open.
      </span>
    </div>
  );
};

export default TrackingInfoAlert;
