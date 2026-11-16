import type { CellContext } from "@tanstack/react-table";

import SessionRatioValue from "~/renderer/components/Table/cells/SessionRatioValue/SessionRatioValue";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import { useCurrentSession } from "~/renderer/store";
import type { CardEntry } from "~/types/data-stores";

const CurrentSessionRatioCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, number>,
) => {
  const { getSession } = useCurrentSession();
  const sessionData = getSession();
  const totalCount = sessionData?.totalCount || 1;
  const cardCount = cellProps.row.original.count;
  const ratio = (cardCount / totalCount) * 100;

  return (
    <SessionRatioValue
      ratio={ratio}
      hidden={cellProps.row.original.price?.hidePrice ?? false}
    />
  );
};

export default CurrentSessionRatioCell;
