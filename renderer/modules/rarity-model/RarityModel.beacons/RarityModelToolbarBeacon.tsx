import type { PopoverComponentProps } from "@repere/react";
import { GiCrownedSkull } from "react-icons/gi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const RarityModelToolbarBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Comparison Filters"
      subtitle="Fine-tune which cards appear in the comparison table."
      {...props}
    >
      <div className="space-y-3">
        <ul className="space-y-2 text-sm text-base-content/80">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content inline-flex items-center gap-1">
                <GiCrownedSkull className="w-3.5 h-3.5 text-warning/70" />
                Include boss cards
              </strong>{" "}
              — toggle to show or hide cards that only drop from bosses and
              cannot appear in Stacked Decks
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content">
                Show differences only
              </strong>{" "}
              — filter the table to only show cards where your filter&apos;s
              rarity differs from poe.ninja (available once at least one filter
              is parsed)
            </span>
          </li>
        </ul>
      </div>
    </Popover>
  );
};

export default RarityModelToolbarBeacon;
