import { useCardDetails } from "~/renderer/store";

/**
 * Grid displaying the current unit price, trade volume, and full set value.
 *
 * Reads all data directly from the Zustand store — no props needed.
 */
const PriceGrid = () => {
  const { card, priceHistory, getFullSetValue, getFullSetChaosValue } =
    useCardDetails();

  const currentDivineRate = priceHistory?.currentDivineRate ?? null;
  const currentVolume = priceHistory?.currentVolume ?? null;
  const stackSize = card?.stackSize ?? 1;
  const fullSetDivine = getFullSetValue();
  const fullSetChaos = getFullSetChaosValue();

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
      {/* Unit Price */}
      <div>
        <span className="text-base-content/50">Unit Price</span>
        <p className="text-lg font-bold tabular-nums">
          {currentDivineRate !== null
            ? `${currentDivineRate.toFixed(2)} div`
            : "—"}
        </p>
      </div>

      {/* Volume */}
      <div>
        <span className="text-base-content/50">Trade Volume</span>
        <p className="font-semibold tabular-nums">
          {currentVolume !== null ? currentVolume.toLocaleString() : "—"}
        </p>
      </div>

      {/* Full Set Value */}
      {fullSetDivine !== null && (
        <div className="col-span-2">
          <span className="text-base-content/50">Full Set ({stackSize}×)</span>
          <p className="font-semibold tabular-nums">
            {fullSetDivine.toFixed(2)} div
            {fullSetChaos !== null && (
              <span className="text-base-content/40 ml-2">
                ≈ {fullSetChaos.toLocaleString()} chaos
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default PriceGrid;
