import type { PopoverComponentProps } from "@repere/react";
import { FiEdit2, FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const PFBaseRateBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Base Rate"
      subtitle="The current stacked deck exchange rate."
      {...props}
    >
      <div className="space-y-2 text-sm text-base-content/80">
        <p>
          Shows how many stacked decks you get per divine orb at the current
          market rate, sourced from poe.ninja bulk exchange data.
        </p>
        <p>
          A <strong className="text-base-content">derived</strong> badge means
          bulk exchange data was unavailable, so the rate was estimated from
          divine ÷ stacked deck price — a rougher approximation.
        </p>
        <p>
          Click the{" "}
          <FiEdit2 className="inline w-3.5 h-3.5 text-base-content/50" /> pencil
          icon to set a{" "}
          <strong className="text-base-content">custom rate</strong>. This
          overrides the market rate for all cost calculations — useful when you
          plan to place exchange orders at a fixed price and wait for them to
          fill.
        </p>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            This is the starting rate used by the cost model. All slider
            adjustments build on top of it.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default PFBaseRateBeacon;
