import { useCardDetails } from "~/renderer/store";

import PriceChangePill from "./PriceChangePill";

/**
 * Row of 24h / 7d / 30d price change pills.
 *
 * Only renders when at least one change period has data.
 * Reads price changes directly from the Zustand store — no props needed.
 */
const PriceChangesRow = () => {
  const { getPriceChanges } = useCardDetails();

  const priceChanges = getPriceChanges();

  const hasPriceChanges =
    priceChanges.change24h !== undefined ||
    priceChanges.change7d !== undefined ||
    priceChanges.change30d !== undefined;

  if (!hasPriceChanges) return null;

  return (
    <div className="border-t border-base-300 pt-3">
      <div className="flex items-center justify-around">
        <PriceChangePill label="24h" change={priceChanges.change24h} />
        <PriceChangePill label="7d" change={priceChanges.change7d} />
        <PriceChangePill label="30d" change={priceChanges.change30d} />
      </div>
    </div>
  );
};

export default PriceChangesRow;
