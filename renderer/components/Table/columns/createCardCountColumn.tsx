import { createColumnHelper } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import { CardCountCell } from "../cells";
import type { AppTableFeatures } from "../Table.utils";
import TableHeader from "../TableHeader";

const columnHelper = createColumnHelper<AppTableFeatures, CardEntry>();

export const createCardCountColumn = () => {
  return columnHelper.accessor("count", {
    id: "count",
    header: () => <TableHeader>Count</TableHeader>,
    cell: (info) => <CardCountCell {...info} />,
  });
};

export default createCardCountColumn;
