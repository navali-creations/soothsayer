import { FiInfo } from "react-icons/fi";

import { useProfitForecast } from "~/renderer/store";

import { RATE_FLOOR } from "../../ProfitForecast.slice/ProfitForecast.slice";
import PFBatchSizeChips from "./PFBatchSizeChips/PFBatchSizeChips";
import PFExcludedCards from "./PFExcludedCards/PFExcludedCards";
import PFMinPriceSlider from "./PFMinPriceSlider/PFMinPriceSlider";
import PFStepDropSlider from "./PFStepDropSlider/PFStepDropSlider";
import PFSubBatchSlider from "./PFSubBatchSlider/PFSubBatchSlider";
import PFViewToggle from "./PFViewToggle/PFViewToggle";

const PFCostModelPanel = () => {
  const { customBaseRate, getEffectiveBaseRate } = useProfitForecast();

  const effectiveRate = getEffectiveBaseRate();
  const hasCustomRate = customBaseRate !== null;
  const isRateClamped = effectiveRate > 0 && effectiveRate === RATE_FLOOR;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="card bg-base-200 shadow-xl"
        data-onboarding="pf-cost-model"
      >
        <div className="card-body p-3 flex flex-col gap-2.5 text-sm">
          {/* Rate clamped note */}
          {isRateClamped && !hasCustomRate && (
            <div className="flex items-start gap-1.5 text-xs text-info">
              <FiInfo className="shrink-0 w-3.5 h-3.5 mt-0.5" />
              <span>Rate clamped to minimum ({RATE_FLOOR} decks/div).</span>
            </div>
          )}

          {/* Batch size chips */}
          <PFBatchSizeChips />

          <div className="border-t border-base-content/10" />

          {/* View toggle: Chart / Table */}
          <PFViewToggle />

          <div className="border-t border-base-content/10" />

          {/* Price increase per batch */}
          <PFStepDropSlider />

          {/* Sub-batch size */}
          <PFSubBatchSlider />

          <div className="border-t border-base-content/10" />

          {/* Min price filter */}
          <PFMinPriceSlider />
        </div>
      </div>

      {/* Excluded cards info — outside the card, no background */}
      <PFExcludedCards />
    </div>
  );
};

export default PFCostModelPanel;
