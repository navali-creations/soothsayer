import type { CellContext } from "@tanstack/react-table";

import SessionPriceVisibilityButton from "~/renderer/components/Table/cells/SessionPriceVisibilityButton/SessionPriceVisibilityButton";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionHidePriceCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, string>,
) => {
  const card = cellProps.row.original;
  return (
    <SessionPriceVisibilityButton
      kind="current"
      cardName={card.name}
      hidden={card.price?.hidePrice ?? false}
      hasPrice={!!card.price}
    />
  );
};

export default CurrentSessionHidePriceCell;
