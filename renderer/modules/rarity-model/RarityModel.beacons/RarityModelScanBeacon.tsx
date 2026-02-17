import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const RarityModelScanBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Scan & Filter Selection"
      subtitle="Discover installed loot filters and select up to 3 to compare rarity assignments."
      {...props}
    >
      <div className="space-y-3">
        <ul className="space-y-2 text-sm text-base-content/80">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content">Scan</strong> detects local
              and online filters — runs automatically on first visit
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              Open the <strong className="text-base-content">Filters</strong>{" "}
              dropdown to pick filters — each one becomes a column in the table
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              Click a filter column&apos;s rarity badge to adjust it for your
              stacked deck tracking
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-warning">Outdated</strong> means the
              filter was not updated within 3 days of a new league start
            </span>
          </li>
        </ul>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            Your active filter from Settings is pre-selected automatically.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default RarityModelScanBeacon;
