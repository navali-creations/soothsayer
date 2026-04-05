import { FiInfo } from "react-icons/fi";

import { usePoeNinja, useProfitForecast } from "~/renderer/store";

const PFStepDropSlider = () => {
  const {
    stepDrop,
    selectedBatch,
    customBaseRate,
    stackedDeckChaosCost,
    setStepDrop,
    setIsComputing,
    isLoading,
  } = useProfitForecast();
  const { isRefreshing } = usePoeNinja();

  const controlsDisabled = isRefreshing || isLoading;
  const hasCustomRate = customBaseRate !== null;
  const hasStackedDeckPrice = stackedDeckChaosCost > 0;

  const handleStepDropChange = (value: number) => {
    setIsComputing(true);
    setStepDrop(value);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-base-content/50 font-medium">
          Price increase per batch
        </span>
        {hasCustomRate && (
          <span
            className="tooltip tooltip-right"
            data-tip="Locked at 0 — custom rate means you pay a fixed price per deck."
          >
            <FiInfo className="w-3 h-3 text-info" />
          </span>
        )}
        {!hasCustomRate && selectedBatch <= 1000 && (
          <span
            className="tooltip tooltip-right"
            data-tip="Disabled — only one batch at 1k decks, so the rate never drops."
          >
            <FiInfo className="w-3 h-3 text-info" />
          </span>
        )}
      </div>
      <input
        type="range"
        min={1}
        max={5}
        step={1}
        value={stepDrop}
        onChange={(e) => handleStepDropChange(Number(e.target.value))}
        className="range range-xs range-primary w-full"
        disabled={
          controlsDisabled ||
          !hasStackedDeckPrice ||
          selectedBatch <= 1000 ||
          hasCustomRate
        }
      />
      <div className="flex justify-between text-xs text-base-content/40">
        <span>1</span>
        <span className="font-mono text-base-content/70">
          &minus;{stepDrop} decks/div
        </span>
        <span>5</span>
      </div>
    </div>
  );
};

export default PFStepDropSlider;
