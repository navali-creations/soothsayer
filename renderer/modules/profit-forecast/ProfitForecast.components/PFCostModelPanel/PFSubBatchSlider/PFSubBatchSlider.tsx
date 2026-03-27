import { FiInfo } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

const PFSubBatchSlider = () => {
  const {
    profitForecast: {
      subBatchSize,
      customBaseRate,
      stackedDeckChaosCost,
      setSubBatchSize,
      setIsComputing,
      isLoading,
    },
    poeNinja: { isRefreshing },
  } = useBoundStore();

  const controlsDisabled = isRefreshing || isLoading;
  const hasCustomRate = customBaseRate !== null;
  const hasStackedDeckPrice = stackedDeckChaosCost > 0;

  const handleSubBatchSizeChange = (value: number) => {
    setIsComputing(true);
    setSubBatchSize(value);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <span className="text-xs text-base-content/50 font-medium">
          Batch size
        </span>
        {hasCustomRate && (
          <span
            className="tooltip tooltip-right"
            data-tip="Locked — custom rate uses the selected deck count as a single batch."
          >
            <FiInfo className="w-3 h-3 text-info" />
          </span>
        )}
      </div>
      <input
        type="range"
        min={1000}
        max={10000}
        step={1000}
        value={subBatchSize}
        onChange={(e) => handleSubBatchSizeChange(Number(e.target.value))}
        className="range range-xs range-primary w-full"
        disabled={controlsDisabled || !hasStackedDeckPrice || hasCustomRate}
      />
      <div className="flex justify-between text-xs text-base-content/40">
        <span>1k</span>
        <span className="font-mono text-base-content/70">
          {subBatchSize.toLocaleString("en-US")} decks
        </span>
        <span>10k</span>
      </div>
    </div>
  );
};

export default PFSubBatchSlider;
