import { useBoundStore } from "~/renderer/store";

import PriceChangesRow from "./PriceChangesRow";
import PriceGrid from "./PriceGrid";
import PriceSummaryEmpty from "./PriceSummaryEmpty";
import PriceSummaryError from "./PriceSummaryError";
import PriceSummaryHeader from "./PriceSummaryHeader";
import PriceSummaryLoading from "./PriceSummaryLoading";

/**
 * Price summary panel for the card details Market Data tab.
 *
 * Handles early-return states (loading / error / empty) and composes
 * the sub-components that each read their own data from the Zustand store.
 * No props needed — all data flows through the store.
 */
const CardDetailsPriceSummary = () => {
  const {
    cardDetails: { priceHistory, isLoadingPriceHistory, priceHistoryError },
  } = useBoundStore();

  if (isLoadingPriceHistory) return <PriceSummaryLoading />;
  if (priceHistoryError) return <PriceSummaryError error={priceHistoryError} />;
  if (!priceHistory) return <PriceSummaryEmpty />;

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-4">
      <PriceSummaryHeader />
      <PriceGrid />
      <PriceChangesRow />
    </div>
  );
};

export default CardDetailsPriceSummary;
