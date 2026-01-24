import { createColumnHelper } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import { CardNameCell } from "../cells";
import TableHeader from "../TableHeader";

const columnHelper = createColumnHelper<CardEntry>();

export const createCardNameColumn = () => {
  return columnHelper.accessor("name", {
    id: "name",
    header: () => <TableHeader>Card Name</TableHeader>,
    cell: (info) => <CardNameCell {...info} />,
  });
};

export default createCardNameColumn;
