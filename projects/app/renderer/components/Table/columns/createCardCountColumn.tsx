import { createColumnHelper } from "@tanstack/react-table";

import type { CardEntry } from "../../../../types/data-stores";
import { CardCountCell } from "../cells";
import TableHeader from "../TableHeader";

const columnHelper = createColumnHelper<CardEntry>();

export const createCardCountColumn = () => {
  return columnHelper.accessor("count", {
    id: "count",
    header: () => <TableHeader>Count</TableHeader>,
    cell: (info) => <CardCountCell {...info} />,
  });
};

export default createCardCountColumn;
