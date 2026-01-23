import { createColumnHelper } from "@tanstack/react-table";

import type {
  CardEntry,
  PriceSource,
} from "../../../../../../../types/data-stores";
import { TableHeader } from "../../../../../../components";
import CurrentSessionTotalValueCell from "./CurrentSessionTotalValueCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionTotalValueColumn = (
  priceSource: PriceSource,
) => {
  return columnHelper.accessor("count", {
    id: "totalValue",
    header: () => <TableHeader>Total Value</TableHeader>,
    cell: (info) => <CurrentSessionTotalValueCell {...info} />,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      // Use the priceSource from the closure
      const valueA =
        priceSource === "stash"
          ? (rowA.original.stashPrice?.totalValue ?? 0)
          : (rowA.original.exchangePrice?.totalValue ?? 0);
      const valueB =
        priceSource === "stash"
          ? (rowB.original.stashPrice?.totalValue ?? 0)
          : (rowB.original.exchangePrice?.totalValue ?? 0);
      return valueA - valueB;
    },
  });
};

export default createCurrentSessionTotalValueColumn;
