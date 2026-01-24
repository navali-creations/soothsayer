import { createColumnHelper } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import { CardRatioCell } from "../cells";
import TableHeader from "../TableHeader";

const columnHelper = createColumnHelper<CardEntry>();

export const createCardRatioColumn = (totalCount: number) => {
  return columnHelper.accessor(
    (row) => (totalCount > 0 ? (row.count / totalCount) * 100 : 0),
    {
      id: "ratio",
      header: () => (
        <TableHeader tooltip="How often you've found this card compared to all other cards">
          Ratio
        </TableHeader>
      ),
      cell: (info) => <CardRatioCell {...info} />,
    },
  );
};

export default createCardRatioColumn;
