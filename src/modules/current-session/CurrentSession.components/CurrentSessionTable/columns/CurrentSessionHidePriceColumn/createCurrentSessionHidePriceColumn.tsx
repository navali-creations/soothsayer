import { createColumnHelper } from "@tanstack/react-table";
import { FiEye } from "react-icons/fi";
import type { CardEntry } from "../../../../../../../types/data-stores";
import { TableHeader } from "../../../../../../components";
import CurrentSessionHidePriceCell from "./CurrentSessionHidePriceCell";

const columnHelper = createColumnHelper<CardEntry>();

export const createCurrentSessionHidePriceColumn = () => {
  return columnHelper.accessor("name", {
    id: "hidePrice",
    header: () => (
      <TableHeader tooltip="Hide anomalous prices from total calculations">
        <FiEye size={14} />
      </TableHeader>
    ),
    cell: (cellProps) => <CurrentSessionHidePriceCell {...cellProps} />,
    size: 50,
    enableSorting: false,
  });
};

export default createCurrentSessionHidePriceColumn;
