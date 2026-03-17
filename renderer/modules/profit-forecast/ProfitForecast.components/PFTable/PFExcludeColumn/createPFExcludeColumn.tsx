import { createColumnHelper } from "@tanstack/react-table";
import { FiEye } from "react-icons/fi";

import { TableHeader } from "~/renderer/components";

import type { CardForecastRow } from "../../../ProfitForecast.slice";
import PFExcludeCell from "./PFExcludeCell";

const columnHelper = createColumnHelper<CardForecastRow>();

export const createPFExcludeColumn = () => {
  return columnHelper.display({
    id: "exclude",
    header: () => (
      <TableHeader
        tooltip="Include/exclude card from EV calculations"
        className="flex w-full justify-center pl-1"
      >
        <FiEye size={14} />
      </TableHeader>
    ),
    cell: (cellProps) => <PFExcludeCell {...cellProps} />,
    size: 50,
    minSize: 50,
    maxSize: 50,
    enableSorting: false,
    enableGlobalFilter: false,
  });
};

export default createPFExcludeColumn;
