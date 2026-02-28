import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const PFBreakEvenBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Break-Even Rate"
      subtitle="The minimum exchange rate needed to profit."
      {...props}
    >
      <div className="space-y-2 text-sm text-base-content/80">
        <p>
          The theoretical minimum decks-per-divine at which opening stacked
          decks becomes profitable. If you're getting{" "}
          <strong>more decks per divine</strong> than this number, you're making
          money on average.
        </p>
        <p className="text-base-content/60 text-xs">
          <code className="bg-base-300 px-1 rounded">
            chaos per divine ÷ EV (expected value) per deck
          </code>
        </p>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            Batch-independent — only depends on the current expected value per
            deck and the chaos-to-divine ratio.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default PFBreakEvenBeacon;
