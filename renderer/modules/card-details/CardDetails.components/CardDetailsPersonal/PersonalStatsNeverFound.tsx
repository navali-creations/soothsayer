import { FiLayers } from "react-icons/fi";

const PersonalStatsNeverFound = () => (
  <div className="flex flex-col items-center justify-center py-6 gap-2">
    <FiLayers className="w-8 h-8 text-base-content/20" />
    <p className="text-sm text-base-content/50">
      You haven't found this card yet
    </p>
    <p className="text-xs text-base-content/30">
      Drop data will appear here once you find one
    </p>
  </div>
);

export default PersonalStatsNeverFound;
