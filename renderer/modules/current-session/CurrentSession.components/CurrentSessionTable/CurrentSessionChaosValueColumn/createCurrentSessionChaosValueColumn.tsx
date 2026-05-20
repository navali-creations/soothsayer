import { createColumnHelper } from "@tanstack/react-table";

import { TableHeader } from "~/renderer/components";
import type { CardEntry } from "~/types/data-stores";

import CurrentSessionChaosValueCell from "./CurrentSessionChaosValueCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionChaosValueColumn = () => {
  return columnHelper.accessor("count", {
    id: "chaosValue",
    header: () => <TableHeader>Value (Each)</TableHeader>,
    cell: (info) => <CurrentSessionChaosValueCell {...info} />,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const valueA = rowA.original.price?.chaosValue ?? 0;
      const valueB = rowB.original.price?.chaosValue ?? 0;
      return valueA - valueB;
    },
  });
};

export default createCurrentSessionChaosValueColumn;
