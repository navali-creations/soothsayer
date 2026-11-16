import { createColumnHelper } from "@tanstack/react-table";

import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import type { CardEntry } from "~/types/data-stores";

import CurrentSessionRatioCell from "./CurrentSessionRatioCell";

const columnHelper = createColumnHelper<AppTableFeatures, CardEntry>();

export const createCurrentSessionRatioColumn = () => {
  return columnHelper.accessor("count", {
    id: "ratio",
    header: () => (
      <Tooltip
        as="div"
        content="How often this card appeared compared to all other cards"
      >
        Ratio
      </Tooltip>
    ),
    cell: (info) => <CurrentSessionRatioCell {...info} />,
  });
};

export default createCurrentSessionRatioColumn;
