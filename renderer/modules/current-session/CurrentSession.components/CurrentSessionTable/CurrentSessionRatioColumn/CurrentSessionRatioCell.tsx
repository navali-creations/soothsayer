import type { CellContext } from "@tanstack/react-table";

import { useBoundStore } from "~/renderer/store";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionRatioCell = (cellProps: CellContext<CardEntry, number>) => {
  const {
    currentSession: { getSession },
  } = useBoundStore();
  const sessionData = getSession();
  const totalCount = sessionData?.totalCount || 1;
  const cardCount = cellProps.row.original.count;
  const ratio = (cardCount / totalCount) * 100;

  return <div className="badge badge-soft">{ratio.toFixed(2)}%</div>;
};

export default CurrentSessionRatioCell;
