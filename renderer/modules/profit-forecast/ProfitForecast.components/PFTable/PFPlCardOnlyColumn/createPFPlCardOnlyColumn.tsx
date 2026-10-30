import { createColumnHelper } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";

import type { CardForecastRow } from "../../../ProfitForecast.slice/ProfitForecast.slice";
import PFPlCardOnlyCell from "./PFPlCardOnlyCell";

const columnHelper = createColumnHelper<AppTableFeatures, CardForecastRow>();

export const createPFPlCardOnlyColumn = () => {
  return columnHelper.accessor("plA", {
    id: "plA",
    header: () => (
      <span data-onboarding="pf-pl-card-only">P&L (card only)</span>
    ),
    cell: (info) => <PFPlCardOnlyCell {...info} />,
    size: 120,
    enableGlobalFilter: false,
  });
};

export default createPFPlCardOnlyColumn;
