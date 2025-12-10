import { createColumnHelper } from "@tanstack/react-table";
import type { CardEntry } from "../../../../../../../types/data-stores";
import { TableHeader } from "../../../../../../components";
import CurrentSessionCountCell from "./CurrentSessionCountCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionCountColumn = () => {
  return columnHelper.accessor("count", {
    id: "count",
    header: () => <TableHeader>Count</TableHeader>,
    cell: (info) => <CurrentSessionCountCell {...info} />,
  });
};

export default createCurrentSessionCountColumn;
