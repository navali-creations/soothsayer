import type { CellContext } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

const CardRatioCell = (cellProps: CellContext<CardEntry, number>) => {
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
