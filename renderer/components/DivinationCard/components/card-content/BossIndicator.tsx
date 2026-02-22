import { GiCrownedSkull } from "react-icons/gi";

interface BossIndicatorProps {
  fromBoss: boolean;
}

export const BossIndicator = ({ fromBoss }: BossIndicatorProps) => {
  if (!fromBoss) {
    return null;
  }

  return (
    <div
      className="absolute -top-5 -right-5 z-100 bg-base-300 rounded-full p-3"
      title="Boss-exclusive card"
    >
      <GiCrownedSkull className="w-8 h-8 text-warning/70" />
    </div>
  );
};
