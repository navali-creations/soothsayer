import { createColumnHelper } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import PFChanceCell from "./PFChanceCell";

const columnHelper = createColumnHelper<AppTableFeatures, CardForecastRow>();

export const createPFChanceColumn = () => {
  return columnHelper.accessor("chanceInBatch", {
    id: "chanceInBatch",
    header: "% Chance",
    cell: (info) => <PFChanceCell {...info} />,
    size: 100,
    enableGlobalFilter: false,
  });
};

export default createPFChanceColumn;
