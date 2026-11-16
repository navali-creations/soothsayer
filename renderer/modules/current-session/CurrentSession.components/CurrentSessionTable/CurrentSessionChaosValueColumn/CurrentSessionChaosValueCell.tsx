import type { CellContext } from "@tanstack/react-table";

import SessionPriceValue from "~/renderer/components/Table/cells/SessionPriceValue/SessionPriceValue";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionChaosValueCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, number>,
) => {
  const price = cellProps.row.original.price;
  return (
    <SessionPriceValue
      kind="current"
      value={price?.chaosValue ?? 0}
      hidden={price?.hidePrice ?? false}
    />
  );
};

export default CurrentSessionChaosValueCell;
