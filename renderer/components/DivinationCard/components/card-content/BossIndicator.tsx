import { GiCrownedSkull } from "react-icons/gi";

import Tooltip from "~/renderer/components/Tooltip/Tooltip";

interface BossIndicatorProps {
  fromBoss: boolean;
}

export const BossIndicator = ({ fromBoss }: BossIndicatorProps) => {
  if (!fromBoss) {
    return null;
  }

  return (
    <Tooltip
      as="div"
      className="absolute -top-5 -right-5 z-100 bg-base-300 rounded-full p-3"
      content="Boss-exclusive card"
    >
      <GiCrownedSkull className="w-8 h-8 text-warning/70" />
    </Tooltip>
  );
};
