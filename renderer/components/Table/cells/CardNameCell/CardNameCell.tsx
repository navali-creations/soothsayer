import type { CellContext } from "@tanstack/react-table";

import type { CardEntry } from "~/types/data-stores";

import type { AppTableFeatures } from "../../Table.utils";
import SessionCardName from "../SessionCardName/SessionCardName";

const CardNameCell = (
  cellProps: CellContext<AppTableFeatures, CardEntry, string>,
) => {
  const card = cellProps.row.original;
  return (
    <SessionCardName
      card={{ ...card, name: cellProps.getValue() }}
      hidden={card.price?.hidePrice ?? false}
    />
  );
};

export default CardNameCell;
