import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const RarityModelPoeNinjaBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="poe.ninja Rarity Column"
      subtitle="Card rarities derived from current poe.ninja pricing data."
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
              Outlined badges in filter columns indicate a mismatch with
              poe.ninja
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              Toggle{" "}
              <strong className="text-base-content">
                &quot;Show differences only&quot;
              </strong>{" "}
              to quickly find mismatches
            </span>
          </li>
        </ul>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            A warning icon means poe.ninja has low confidence or no data for
            that card.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default RarityModelPoeNinjaBeacon;
