import clsx from "clsx";

import { usePoeNinja, useProfitForecast } from "~/renderer/store";

import type { BatchSize } from "../../../ProfitForecast.slice/ProfitForecast.slice";

const BATCH_OPTIONS: { value: BatchSize; label: string }[] = [
  { value: 1000, label: "1k" },
  { value: 10000, label: "10k" },
  { value: 100000, label: "100k" },
  { value: 1000000, label: "1M" },
];

const PFBatchSizeChips = () => {
  const { selectedBatch, setSelectedBatch, setIsComputing, isLoading } =
    useProfitForecast();
  const { isRefreshing } = usePoeNinja();

  const disabled = isRefreshing || isLoading;

  const handleBatchChange = (batch: BatchSize) => {
    if (!disabled && selectedBatch !== batch) {
      setIsComputing(true);
      setSelectedBatch(batch);
    }
  };

  return (
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
              disabled && "opacity-50 cursor-not-allowed",
            )}
            onClick={() => handleBatchChange(value)}
            disabled={disabled}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PFBatchSizeChips;
