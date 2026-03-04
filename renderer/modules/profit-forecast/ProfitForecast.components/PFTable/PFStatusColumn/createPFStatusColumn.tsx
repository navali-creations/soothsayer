import { createColumnHelper } from "@tanstack/react-table";

import type { CardForecastRow } from "../../../ProfitForecast.slice";
import PFStatusCell from "./PFStatusCell";

const columnHelper = createColumnHelper<CardForecastRow>();

export const createPFStatusColumn = () => {
  return columnHelper.display({
    id: "status",
    header: "",
    cell: (info) => <PFStatusCell {...info} />,
    size: 30,
    minSize: 30,
    maxSize: 30,
    enableSorting: false,
    enableGlobalFilter: false,
  });
};

export default createPFStatusColumn;
