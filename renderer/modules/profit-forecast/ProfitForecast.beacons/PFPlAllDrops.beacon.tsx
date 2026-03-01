import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const PFPlAllDropsBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="P&L (all drops)"
      subtitle="Your actual profit if you sell everything you find."
      className="w-[500px]"
      {...props}
    >
      <div className="space-y-2 text-sm text-base-content/80">
        <p>
          While opening enough decks to pull the target card, you'll also get
          many other cards. This column accounts for{" "}
          <strong>all of them</strong> — it uses the EV of every deck times the
          number of decks needed, minus the total cost.
        </p>
        <p className="text-base-content/60 text-xs">
          Formula:{" "}
          <code className="bg-base-300 px-1 rounded">
            (decks needed × EV per deck) − cost of those decks
          </code>
        </p>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            This is the more realistic number if you plan to sell everything —
            not just the target card. Also batch-independent.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default PFPlAllDropsBeacon;
