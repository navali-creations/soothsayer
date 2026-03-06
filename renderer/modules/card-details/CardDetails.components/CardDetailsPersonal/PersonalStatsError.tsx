import { FiAlertTriangle } from "react-icons/fi";

const PersonalStatsError = ({ message }: { message: string }) => (
  <div className="flex items-center gap-2 py-2 text-error">
    <FiAlertTriangle className="w-4 h-4 shrink-0" />
    <span className="text-sm">{message}</span>
  </div>
);

export default PersonalStatsError;
