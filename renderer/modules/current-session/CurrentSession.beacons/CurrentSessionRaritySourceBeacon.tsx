import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const CurrentSessionRaritySourceBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Rarity Source"
      subtitle="Choose how card rarities are determined for your session tracking."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <p className="font-semibold text-primary flex items-center">
            Available Sources
          </p>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                <strong className="text-base-content">poe.ninja</strong> —
                rarities are derived from current market pricing data
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                <strong className="text-base-content">Loot Filters</strong> —
                rarities are taken from your installed filters (local or online)
              </span>
            </li>
          </ul>
        </div>

        <div className="divider my-2"></div>

        <div className="space-y-2">
          <p className="font-semibold text-primary flex items-center">
            How It Works
          </p>
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                The selected source determines how each divination card&apos;s
                rarity tier is assigned during your session
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Filter-based sources use the rarity tiers defined in the
                filter&apos;s rules — edit these on the{" "}
                <strong className="text-base-content">Rarity Model</strong> page
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Filters marked{" "}
                <strong className="text-warning">outdated</strong> were not
                updated within 3 days of a new league start
              </span>
            </li>
          </ul>
        </div>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            The rarity source cannot be changed while a session is active. Stop
            the current session first to switch sources.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default CurrentSessionRaritySourceBeacon;
