import { createColumnHelper } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import PFPriceCell from "./PFPriceCell";

const columnHelper = createColumnHelper<AppTableFeatures, CardForecastRow>();

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
