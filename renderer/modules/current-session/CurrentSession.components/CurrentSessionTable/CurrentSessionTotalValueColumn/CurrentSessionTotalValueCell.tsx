import type { CellContext } from "@tanstack/react-table";

import SessionPriceValue from "~/renderer/components/Table/cells/SessionPriceValue/SessionPriceValue";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionTotalValueCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, number>,
) => {
  const price = cellProps.row.original.price;
  return (
    <SessionPriceValue
      kind="current"
      value={price?.totalValue ?? 0}
      hidden={price?.hidePrice ?? false}
      total
    />
  );
};

export default CurrentSessionTotalValueCell;
