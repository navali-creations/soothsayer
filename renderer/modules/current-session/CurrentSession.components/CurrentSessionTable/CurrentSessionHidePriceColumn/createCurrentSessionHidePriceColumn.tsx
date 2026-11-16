import { createColumnHelper } from "@tanstack/react-table";

import SessionPriceVisibilityHeader from "~/renderer/components/Table/SessionPriceVisibilityHeader/SessionPriceVisibilityHeader";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import type { CardEntry } from "~/types/data-stores";

import CurrentSessionHidePriceCell from "./CurrentSessionHidePriceCell";

const columnHelper = createColumnHelper<AppTableFeatures, CardEntry>();

export const createCurrentSessionHidePriceColumn = () => {
  return columnHelper.accessor("name", {
    id: "hidePrice",
    header: () => <SessionPriceVisibilityHeader />,
    cell: (cellProps) => <CurrentSessionHidePriceCell {...cellProps} />,
    size: 50,
    enableSorting: false,
  });
};

export default createCurrentSessionHidePriceColumn;
