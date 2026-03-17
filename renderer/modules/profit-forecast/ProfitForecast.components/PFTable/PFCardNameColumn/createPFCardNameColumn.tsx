import { createColumnHelper } from "@tanstack/react-table";

import type { DivinationCardMetadata } from "~/types/data-stores";

import type { CardForecastRow } from "../../../ProfitForecast.slice";
import PFCardNameCell from "./PFCardNameCell";

const columnHelper = createColumnHelper<CardForecastRow>();

export const createPFCardNameColumn = (
  cardMetadataMap: Map<string, DivinationCardMetadata>,
) => {
  return columnHelper.accessor("cardName", {
    id: "cardName",
    header: "Card Name",
    cell: (info) => (
      <PFCardNameCell
        cardName={info.getValue()}
        cardMetadata={cardMetadataMap.get(info.getValue()) ?? null}
        belowMinPrice={info.row.original.belowMinPrice}
      />
    ),
    size: 200,
    minSize: 150,
    meta: { alignStart: true },
    enableGlobalFilter: true,
  });
};

export default createPFCardNameColumn;
