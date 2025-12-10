import { createColumnHelper } from "@tanstack/react-table";
import type { CardEntry } from "../../../../../../../types/data-stores";
import { TableHeader } from "../../../../../../components";
import CurrentSessionNameCell from "./CurrentSessionNameCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionNameColumn = () => {
  return columnHelper.accessor("name", {
    id: "name",
    header: () => <TableHeader>Card Name</TableHeader>,
    cell: (info) => <CurrentSessionNameCell {...info} />,
  });
};

export default createCurrentSessionNameColumn;
