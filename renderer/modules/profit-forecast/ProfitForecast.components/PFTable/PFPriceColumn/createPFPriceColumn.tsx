import { createColumnHelper } from "@tanstack/react-table";

import type { CardForecastRow } from "../../../ProfitForecast.slice";
import PFPriceCell from "./PFPriceCell";

const columnHelper = createColumnHelper<CardForecastRow>();

export const createPFPriceColumn = () => {
  return columnHelper.accessor("divineValue", {
    id: "divineValue",
    header: "Price",
    cell: (info) => <PFPriceCell {...info} />,
    size: 100,
    enableGlobalFilter: false,
  });
};

export default createPFPriceColumn;
