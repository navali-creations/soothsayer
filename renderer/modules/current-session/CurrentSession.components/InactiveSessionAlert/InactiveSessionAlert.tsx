import { FiInfo } from "react-icons/fi";

const InactiveSessionAlert = () => {
  return (
    <div className="alert alert-soft alert-info bg-base-200 mb-4">
      <FiInfo className="shrink-0 w-6 h-6" />
      <span>
        No active session. Select a league and click &quot;Start Session&quot;
        to begin tracking.
      </span>
    </div>
  );
};

export default InactiveSessionAlert;
