import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const PFPlCardOnlyBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="P&L (card only)"
      subtitle="Is this single card worth farming on its own?"
      {...props}
    >
      <div className="space-y-2 text-sm text-base-content/80">
        <p>
          Takes the card's sell price and subtracts the cost of all decks needed
          (on average) to pull one copy. Every other card you get along the way
          is <strong>ignored</strong>.
        </p>
        <p className="text-base-content/60 text-xs">
          Formula:{" "}
          <code className="bg-base-300 px-1 rounded">
            card price − cost of decks to pull it
          </code>
        </p>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            This value is batch-independent — it doesn't change with how many
            decks you open.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default PFPlCardOnlyBeacon;
