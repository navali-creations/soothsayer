import type { CellContext } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import type { AppTableFeatures } from "../Table.utils";

const CardRatioCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, number>,
) => {
  const value = cellProps.getValue();

  let formatted: string;
  if (value === 0) {
    formatted = "0%";
  } else {
    formatted = `${value.toFixed(7)}%`;
  }

  return <div className="badge badge-soft">{formatted}</div>;
};

export default CardRatioCell;
