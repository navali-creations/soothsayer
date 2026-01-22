import { createColumnHelper } from "@tanstack/react-table";
import type {
  CardEntry,
  PriceSource,
} from "../../../../../../../types/data-stores";
import { TableHeader } from "../../../../../../components";
import CurrentSessionChaosValueCell from "./CurrentSessionChaosValueCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionChaosValueColumn = (
  priceSource: PriceSource,
) => {
  return columnHelper.accessor("count", {
    id: "chaosValue",
    header: () => <TableHeader>Value (Each)</TableHeader>,
    cell: (info) => <CurrentSessionChaosValueCell {...info} />,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const valueA =
        priceSource === "stash"
          ? (rowA.original.stashPrice?.chaosValue ?? 0)
          : (rowA.original.exchangePrice?.chaosValue ?? 0);
      const valueB =
        priceSource === "stash"
          ? (rowB.original.stashPrice?.chaosValue ?? 0)
          : (rowB.original.exchangePrice?.chaosValue ?? 0);
      return valueA - valueB;
    },
  });
};

export default createCurrentSessionChaosValueColumn;
