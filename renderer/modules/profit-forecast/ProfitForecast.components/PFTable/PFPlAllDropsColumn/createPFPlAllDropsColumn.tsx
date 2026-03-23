import { createColumnHelper } from "@tanstack/react-table";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import PFPlAllDropsCell from "./PFPlAllDropsCell";

const columnHelper = createColumnHelper<CardForecastRow>();

export const createPFPlAllDropsColumn = () => {
  return columnHelper.accessor("plB", {
    id: "plB",
    header: () => (
      <span data-onboarding="pf-pl-all-drops">P&L (all drops)</span>
    ),
    cell: (info) => <PFPlAllDropsCell {...info} />,
    size: 120,
    enableGlobalFilter: false,
  });
};

export default createPFPlAllDropsColumn;
