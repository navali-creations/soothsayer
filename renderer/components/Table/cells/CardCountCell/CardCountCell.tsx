import type { CellContext } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import type { AppTableFeatures } from "../../Table.utils";
import SessionCountValue from "../SessionCountValue/SessionCountValue";

const CardCountCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, number>,
) => {
  return (
    <SessionCountValue
      count={cellProps.getValue()}
      hidden={cellProps.row.original.price?.hidePrice}
    />
  );
};

export default CardCountCell;
