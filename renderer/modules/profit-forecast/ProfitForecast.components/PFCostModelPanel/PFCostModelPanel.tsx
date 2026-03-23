import clsx from "clsx";
import { useCallback, useState } from "react";
import { FiAlertOctagon, FiAlertTriangle, FiInfo } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

import type { BatchSize } from "../../ProfitForecast.slice/ProfitForecast.slice";
import { RATE_FLOOR } from "../../ProfitForecast.slice/ProfitForecast.slice";

const BATCH_OPTIONS: { value: BatchSize; label: string }[] = [
  { value: 1000, label: "1k" },
  { value: 10000, label: "10k" },
  { value: 100000, label: "100k" },
  { value: 1000000, label: "1M" },
];

interface PFCostModelPanelProps {
  selectedBatch: BatchSize;
  onBatchChange: (batch: BatchSize) => void;
  onStepDropChange: (value: number) => void;
  onSubBatchSizeChange: (value: number) => void;
}

const PFCostModelPanel = ({
  selectedBatch,
  onBatchChange,
  onStepDropChange,
  onSubBatchSizeChange,
}: PFCostModelPanelProps) => {
  const {
    profitForecast: {
      baseRate,
      stackedDeckChaosCost,
      stepDrop,
      subBatchSize,
      minPriceThreshold,
      setMinPriceThreshold,
      getExcludedCount,
      isLoading,
      hasData,
    },
    poeNinja: { isRefreshing },
  } = useBoundStore();

  const dataAvailable = hasData() && !isLoading;
  const excludedCount = dataAvailable
    ? getExcludedCount()
    : { anomalous: 0, lowConfidence: 0, total: 0 };

  // ─── Local slider state: only commit to store on release ───────────────
  const [localMinPrice, setLocalMinPrice] = useState(minPriceThreshold);
  const [isDragging, setIsDragging] = useState(false);

  // Sync from store when not dragging (e.g. external reset)
  const displayMinPrice = isDragging ? localMinPrice : minPriceThreshold;

  const handleMinPriceInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalMinPrice(Number(e.target.value));
    },
    [],
  );

  const handleMinPriceCommit = useCallback(() => {
    setIsDragging(false);
    setMinPriceThreshold(localMinPrice);
  }, [localMinPrice, setMinPriceThreshold]);

  const controlsDisabled = isRefreshing || isLoading;
  const hasStackedDeckPrice = stackedDeckChaosCost > 0;
  const isRateClamped = baseRate > 0 && baseRate === RATE_FLOOR;

  return (
    <div className="flex flex-col gap-2">
      <div
        className="card bg-base-200 shadow-xl"
        data-onboarding="pf-cost-model"
      >
        <div className="card-body p-3 flex flex-col gap-2.5 text-sm">
          {/* Rate clamped note */}
          {isRateClamped && (
            <div className="flex items-start gap-1.5 text-xs text-info">
              <FiInfo className="shrink-0 w-3.5 h-3.5 mt-0.5" />
              <span>Rate clamped to minimum ({RATE_FLOOR} decks/div).</span>
            </div>
          )}

          {/* Batch size chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-base-content/50 font-medium">
              Decks to open
            </span>
            <div className="flex flex-wrap gap-1.5">
              {BATCH_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={clsx(
                    "badge badge-sm cursor-pointer select-none transition-colors",
                    selectedBatch === value
                      ? "badge-info"
                      : "badge-ghost hover:badge-outline",
                    controlsDisabled && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={() => {
                    if (!controlsDisabled && selectedBatch !== value) {
                      onBatchChange(value);
                    }
                  }}
                  disabled={controlsDisabled}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-base-content/10" />

          {/* Price increase per batch */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-base-content/50 font-medium">
              Price increase per batch
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={stepDrop}
              onChange={(e) => onStepDropChange(Number(e.target.value))}
              className="range range-xs range-primary w-full"
              disabled={controlsDisabled || !hasStackedDeckPrice}
            />
            <div className="flex justify-between text-xs text-base-content/40">
              <span>1</span>
              <span className="font-mono text-base-content/70">
                &minus;{stepDrop} decks/div
              </span>
              <span>5</span>
            </div>
          </div>

          {/* Sub-batch size */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-base-content/50 font-medium">
              Batch size
            </span>
            <input
              type="range"
              min={1000}
              max={10000}
              step={1000}
              value={subBatchSize}
              onChange={(e) => onSubBatchSizeChange(Number(e.target.value))}
              className="range range-xs range-primary w-full"
              disabled={controlsDisabled || !hasStackedDeckPrice}
            />
            <div className="flex justify-between text-xs text-base-content/40">
              <span>1k</span>
              <span className="font-mono text-base-content/70">
                {subBatchSize.toLocaleString("en-US")} decks
              </span>
              <span>10k</span>
            </div>
          </div>

          <div className="border-t border-base-content/10" />

          {/* Min price filter */}
          <div className="flex flex-col gap-1">
            <span className="text-xs text-base-content/50 font-medium">
              Min price filter
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={displayMinPrice}
              onChange={handleMinPriceInput}
              onPointerDown={() => {
                setIsDragging(true);
                setLocalMinPrice(minPriceThreshold);
              }}
              onPointerUp={handleMinPriceCommit}
              onKeyUp={handleMinPriceCommit}
              className="range range-xs range-primary w-full"
              disabled={controlsDisabled}
            />
            <div className="flex justify-between text-xs text-base-content/40">
              <span>0c</span>
              <span className="font-mono text-base-content/70">
                {displayMinPrice}c
              </span>
              <span>100c</span>
            </div>
          </div>
        </div>
      </div>

      {/* Excluded cards info — outside the card, no background */}
      {excludedCount.total > 0 && (
        <div className="flex flex-col gap-1.5 px-1">
          <span className="text-xs text-base-content/50 font-medium">
            Excluded from EV
          </span>

          <div className="flex flex-col gap-1">
            {excludedCount.anomalous > 0 && (
              <span className="badge badge-soft badge-error badge-sm gap-1">
                <FiAlertOctagon className="w-3 h-3" />
                {excludedCount.anomalous} anomalous price
                {excludedCount.anomalous !== 1 ? "s" : ""}
              </span>
            )}
            {excludedCount.lowConfidence > 0 && (
              <span className="badge badge-soft badge-warning badge-sm gap-1">
                <FiAlertTriangle className="w-3 h-3" />
                {excludedCount.lowConfidence} low confidence
              </span>
            )}
          </div>

          <p className="text-[11px] text-base-content/40 leading-tight">
            Cards with unreliable prices are excluded from expected value and
            break-even calculations.
          </p>
        </div>
      )}
    </div>
  );
};

export default PFCostModelPanel;
