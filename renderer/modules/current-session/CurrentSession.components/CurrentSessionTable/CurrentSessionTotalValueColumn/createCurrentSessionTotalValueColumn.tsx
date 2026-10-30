import { createColumnHelper } from "@tanstack/react-table";

import { TableHeader } from "~/renderer/components";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import type { CardEntry } from "~/types/data-stores";

import CurrentSessionTotalValueCell from "./CurrentSessionTotalValueCell";

const columnHelper = createColumnHelper<AppTableFeatures, CardEntry>();

export const createCurrentSessionTotalValueColumn = () => {
  return columnHelper.accessor("count", {
    id: "totalValue",
    header: () => <TableHeader>Total Value</TableHeader>,
    cell: (info) => <CurrentSessionTotalValueCell {...info} />,
    enableSorting: true,
    sortFn: (rowA, rowB) => {
      const valueA = rowA.original.price?.totalValue ?? 0;
      const valueB = rowB.original.price?.totalValue ?? 0;
      return valueA - valueB;
    },
  });
};

export default createCurrentSessionTotalValueColumn;
