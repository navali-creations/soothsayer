import { createColumnHelper } from "@tanstack/react-table";

import { TableHeader } from "~/renderer/components";
import type { CardEntry } from "~/types/data-stores";

import CurrentSessionRadioCell from "./CurrentSessionRatioCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionRatioColumn = () => {
  return columnHelper.accessor("count", {
    id: "ratio",
    header: () => (
      <TableHeader tooltip="How often you've found this card compared to all other cards">
        Ratio
      </TableHeader>
    ),
    cell: (info) => <CurrentSessionRadioCell {...info} />,
  });
};

export default createCurrentSessionRatioColumn;
