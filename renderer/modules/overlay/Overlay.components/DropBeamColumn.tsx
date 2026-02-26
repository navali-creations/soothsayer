import { FiAlertTriangle } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

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
  const {
    overlay: { isLeftHalf },
  } = useBoundStore();

  return (
    <div className="w-10 relative shrink-0">
      {showBeam && <Beam className="absolute inset-0" color={beamColor} />}
      {isUnknownRarity && (
        <div
          className={`absolute inset-0 flex items-center justify-center tooltip ${
            isLeftHalf ? "tooltip-left" : "tooltip-right"
          } tooltip-warning`}
          data-tip="Low confidence price"
        >
          <FiAlertTriangle className="w-4 h-4 text-warning/30" />
        </div>
      )}
    </div>
  );
};
