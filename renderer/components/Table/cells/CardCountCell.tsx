import type { CellContext } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import type { AppTableFeatures } from "../Table.utils";

const CardCountCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, number>,
) => {
  return <div className="badge badge-soft">{cellProps.getValue()}</div>;
};

export default CardCountCell;
