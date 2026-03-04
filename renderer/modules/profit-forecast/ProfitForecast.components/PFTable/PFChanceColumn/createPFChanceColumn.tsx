import { createColumnHelper } from "@tanstack/react-table";

import type { CardForecastRow } from "../../../ProfitForecast.slice";
import PFChanceCell from "./PFChanceCell";

const columnHelper = createColumnHelper<CardForecastRow>();

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
