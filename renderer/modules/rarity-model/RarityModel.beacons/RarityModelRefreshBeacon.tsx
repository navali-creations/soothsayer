import type { PopoverComponentProps } from "@repere/react";
import { FiInfo, FiLock, FiRefreshCw } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const RarityModelRefreshBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Refresh poe.ninja Prices"
      subtitle="Fetch the latest divination card pricing data from poe.ninja to keep rarities up to date."
      {...props}
    >
      <div className="space-y-3">
        <ul className="space-y-2 text-sm text-base-content/80">
          <li className="flex items-start gap-2">
            <FiRefreshCw className="text-accent mt-0.5 shrink-0" size={14} />
            <span>
              Click{" "}
              <strong className="text-base-content">Refresh poe.ninja</strong>{" "}
              to pull the latest prices and recalculate card rarities for your
              current league
            </span>
          </li>
          <li className="flex items-start gap-2">
            <FiLock className="text-warning mt-0.5 shrink-0" size={14} />
            <span>
              After refreshing, the button locks with a{" "}
              <strong className="text-warning">cooldown timer</strong> — this
              prevents excessive requests and ensures poe.ninja data has time to
              update
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              The cooldown is{" "}
              <strong className="text-base-content">per league</strong> —
              switching leagues lets you refresh independently
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              While refreshing, the table shows a loading overlay and inputs are
              temporarily disabled
            </span>
          </li>
        </ul>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            Prices are cached server-side. If data was recently fetched you may
            receive cached results instantly without a cooldown.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default RarityModelRefreshBeacon;
