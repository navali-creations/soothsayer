import { createColumnHelper } from "@tanstack/react-table";
import type { CardEntry } from "../../../../types/data-stores";
import { CardRatioCell } from "../cells";
import TableHeader from "../TableHeader";

const columnHelper = createColumnHelper<CardEntry>();

export const createCardRatioColumn = () => {
  return columnHelper.accessor("ratio", {
    id: "ratio",
    header: () => (
      <TableHeader tooltip="How often you've found this card compared to all other cards">
        Ratio
      </TableHeader>
    ),
    cell: (info) => <CardRatioCell {...info} />,
  });
};

export default createCardRatioColumn;
