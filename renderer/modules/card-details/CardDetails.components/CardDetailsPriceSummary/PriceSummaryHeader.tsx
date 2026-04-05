import { useCardDetails } from "~/renderer/store";
import { formatRelativeTime } from "~/renderer/utils";

import ConfidenceBadge from "./ConfidenceBadge";

/**
 * Header row for the price summary panel.
 *
 * Displays the "Price Data" title, an optional confidence badge,
 * and a cache age indicator when the data is served from the local cache.
 *
 * Reads all data directly from the Zustand store — no props needed.
 */
const PriceSummaryHeader = () => {
  const { priceHistory } = useCardDetails();

  const isFromCache = priceHistory?.isFromCache ?? false;
  const fetchedAt = priceHistory?.fetchedAt ?? null;

  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase text-base-content/50">
        Price Data
      </h3>
      <div className="flex items-center gap-2">
        <ConfidenceBadge confidence={null} />
        {isFromCache && fetchedAt && (
          <span className="badge badge-sm badge-ghost gap-1 text-base-content/40">
            Cached · {formatRelativeTime(fetchedAt)}
          </span>
        )}
      </div>
    </div>
  );
};

export default PriceSummaryHeader;
