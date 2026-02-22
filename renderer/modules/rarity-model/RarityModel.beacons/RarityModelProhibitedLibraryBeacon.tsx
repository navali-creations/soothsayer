import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const RarityModelProhibitedLibraryBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Prohibited Library Column"
      subtitle="Card rarities derived from community-collected stacked deck drop-weight data."
      {...props}
    >
      <div className="space-y-3">
        <ul className="space-y-2 text-sm text-base-content/80">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              Click <strong className="text-base-content">R1–R4</strong> badges
              in the header to sort by that rarity — click again to clear
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              Rarities are based on empirical drop weights collected by the Path
              of Exile Science &amp; Data community
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              Cards not present in the dataset show a{" "}
              <strong className="text-base-content">—</strong> dash instead of a
              rarity badge
            </span>
          </li>
        </ul>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            Weight-based rarities offer an alternative perspective to
            price-based classification from poe.ninja.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default RarityModelProhibitedLibraryBeacon;
