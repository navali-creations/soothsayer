import type { PopoverComponentProps } from "@repere/react";
import Popover from "../../onboarding/Onboarding.components/Popover";

const CurrentSessionPricingBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Price Source Selection"
      subtitle="Choose between different pricing data sources from poe.ninja for your divination cards."
      {...props}
    >
      <div className="space-y-3">
        <div className="space-y-2">
          <ul className="space-y-2 text-sm text-base-content/80">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                <strong className="text-base-content">Exchange API:</strong>{" "}
                Prices based on actual currency exchange trades
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                <strong className="text-base-content">Stash API:</strong> Prices
                based on stash tab listings
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
              <span>Switch between sources to compare pricing data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Your selection applies to all card value calculations in the
                current session
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5">•</span>
              <span>
                Exchange prices often reflect real market value more accurately
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Popover>
  );
};

export default CurrentSessionPricingBeacon;
