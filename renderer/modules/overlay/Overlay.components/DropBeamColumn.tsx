import { FiAlertTriangle } from "react-icons/fi";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";

import Beam from "./Beam/Beam";

interface DropBeamColumnProps {
  showBeam: boolean;
  beamColor?: string;
  isUnknownRarity: boolean;
}

export const DropBeamColumn = ({
  showBeam,
  beamColor,
  isUnknownRarity,
}: DropBeamColumnProps) => {
  return (
    <div className="w-10 relative shrink-0">
      {showBeam && <Beam className="absolute inset-0" color={beamColor} />}
      {isUnknownRarity && (
        <Tooltip
          as="div"
          className="absolute inset-0 flex items-center justify-center"
          content="Low confidence price"
        >
          <FiAlertTriangle className="w-4 h-4 text-warning/30" />
        </Tooltip>
      )}
    </div>
  );
};
