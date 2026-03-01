import type { PopoverComponentProps } from "@repere/react";
import { FiInfo } from "react-icons/fi";

import Popover from "../../onboarding/Onboarding.components/Popover";

const PFCostModelBeacon = (props: PopoverComponentProps) => {
  return (
    <Popover
      title="Cost Model"
      subtitle="Simulate how bulk buying affects your deck prices."
      {...props}
    >
      <div className="space-y-2 text-sm text-base-content/80">
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content">Decks to open:</strong> How
              many stacked decks you plan to buy in total.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content">Price increase:</strong> How
              many fewer decks/div you get after each batch — models rising
              prices as you buy more.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content">Batch size:</strong> How
              many decks you buy before the price steps up.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-accent mt-0.5">•</span>
            <span>
              <strong className="text-base-content">Min price filter:</strong>{" "}
              Hides cards worth less than this amount — useful for cutting noise
              from low-value drops.
            </span>
          </li>
        </ul>

        <div className="alert alert-soft alert-info bg-info/10">
          <FiInfo size={20} />
          <span>
            We can't read the live exchange order book, so adjust sliders to
            match what you actually see on the exchange.
          </span>
        </div>
      </div>
    </Popover>
  );
};

export default PFCostModelBeacon;
