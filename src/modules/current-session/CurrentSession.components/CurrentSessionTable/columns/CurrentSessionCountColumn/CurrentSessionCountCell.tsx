import type { CellContext } from "@tanstack/react-table";
import type { CardEntry } from "../../../../../../../types/data-stores";

const CurrentSessionCountCell = (cellProps: CellContext<CardEntry, number>) => {
  return <div className="badge badge-soft">{cellProps.getValue()}</div>;
};

export default CurrentSessionCountCell;
