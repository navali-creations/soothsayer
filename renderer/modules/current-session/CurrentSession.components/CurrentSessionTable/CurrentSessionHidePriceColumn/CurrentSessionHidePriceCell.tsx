import type { CellContext } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useCurrentSession } from "~/renderer/store";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionHidePriceCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, string>,
) => {
  const { toggleCardPriceVisibility, getSession } = useCurrentSession();

  const sessionData = getSession();
  const cardName = cellProps.row.original.name;
  const hasSnapshot = !!sessionData?.priceSnapshot;

  const priceInfo = cellProps.row.original.price;
  const hidePrice = priceInfo?.hidePrice || false;
  const tooltip = !hasSnapshot
    ? "Price visibility can only be changed when using snapshot prices"
    : hidePrice
      ? "Price hidden from calculations"
      : "Price included in calculations";

  return (
    <div className="flex justify-center">
      <Tooltip as="div" content={tooltip} describeChild>
        <input
          aria-label={tooltip}
          type="checkbox"
          className="checkbox checkbox-sm"
          checked={!hidePrice}
          onChange={() => toggleCardPriceVisibility(cardName)}
          disabled={!hasSnapshot || !priceInfo}
        />
      </Tooltip>
    </div>
  );
};

export default CurrentSessionHidePriceCell;
