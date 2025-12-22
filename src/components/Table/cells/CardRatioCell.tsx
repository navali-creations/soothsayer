import type { CellContext } from "@tanstack/react-table";
import type { CardEntry } from "../../../../types/data-stores";

const CardRatioCell = (cellProps: CellContext<CardEntry, number>) => {
  return (
    <div className="badge badge-soft">{cellProps.getValue().toFixed(2)}%</div>
  );
};

export default CardRatioCell;
