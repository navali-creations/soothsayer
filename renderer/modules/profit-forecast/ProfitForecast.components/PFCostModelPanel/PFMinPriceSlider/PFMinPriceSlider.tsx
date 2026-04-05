import { useCallback, useState } from "react";

import { usePoeNinja, useProfitForecast } from "~/renderer/store";

const PFMinPriceSlider = () => {
  const { minPriceThreshold, setMinPriceThreshold, isLoading } =
    useProfitForecast();
  const { isRefreshing } = usePoeNinja();

  const disabled = isRefreshing || isLoading;

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

  return (
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
        disabled={disabled}
      />
      <div className="flex justify-between text-xs text-base-content/40">
        <span>0c</span>
        <span className="font-mono text-base-content/70">
          {displayMinPrice}c
        </span>
        <span>100c</span>
      </div>
    </div>
  );
};

export default PFMinPriceSlider;
