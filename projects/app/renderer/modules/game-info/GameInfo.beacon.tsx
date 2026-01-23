import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../onboarding/Onboarding.components/Popover";

const GameInfoBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Game & League Selection"
      subtitle="Select which Path of Exile game and league you want to track
    divination cards for."
      {...props}
    >
      <div className="space-y-2">
        <div className="space-y-2">
          <p className="font-semibold text-primary flex items-center">
            League Selection
          </p>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>Switch between available leagues for each game</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                When a league ends, it automatically switches to Standard
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>New leagues become available once they go live</span>
            </li>
          </ul>
        </div>

        <div className="alert alert-soft alert-info bg-accent/20">
          <FiInfo size={20} />
          <span>
            Path of Exile 2 is currently disabled as stacked deck support is not
            yet available.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default GameInfoBeacon;
