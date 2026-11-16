import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";

import { Table } from "~/renderer/components";
import SessionCardName from "~/renderer/components/Table/cells/SessionCardName/SessionCardName";
import SessionCountValue from "~/renderer/components/Table/cells/SessionCountValue/SessionCountValue";
import SessionPriceValue from "~/renderer/components/Table/cells/SessionPriceValue/SessionPriceValue";
import SessionPriceVisibilityButton from "~/renderer/components/Table/cells/SessionPriceVisibilityButton/SessionPriceVisibilityButton";
import SessionRatioValue from "~/renderer/components/Table/cells/SessionRatioValue/SessionRatioValue";
import SessionPriceVisibilityHeader from "~/renderer/components/Table/SessionPriceVisibilityHeader/SessionPriceVisibilityHeader";
import type { AppTableFeatures } from "~/renderer/components/Table/Table.utils";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useSessionDetails } from "~/renderer/store";

import type { CardEntry } from "../../SessionDetails.types";

const columnHelper = createColumnHelper<AppTableFeatures, CardEntry>();

const SessionDetailsTable = () => {
  const { getCardData } = useSessionDetails();
  const cardData = getCardData();
  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "visibility",
        size: 50,
        header: () => <SessionPriceVisibilityHeader />,
        cell: ({ row }) => (
          <SessionPriceVisibilityButton
            kind="details"
            cardName={row.original.name}
            hidden={row.original.hidePrice ?? false}
          />
        ),
      }),
      columnHelper.accessor("name", {
        header: "Card Name",
        cell: ({ row }) => (
          <SessionCardName
            card={row.original}
            hidden={row.original.hidePrice ?? false}
          />
        ),
      }),
      columnHelper.accessor("count", {
        header: "Count",
        cell: ({ row, getValue }) => (
          <SessionCountValue
            count={getValue()}
            hidden={row.original.hidePrice}
          />
        ),
      }),
      columnHelper.accessor("ratio", {
        header: () => (
          <Tooltip
            as="div"
            content="How often this card appeared compared to all other cards"
          >
            Ratio
          </Tooltip>
        ),
        cell: ({ row, getValue }) => (
          <SessionRatioValue
            ratio={getValue()}
            hidden={row.original.hidePrice}
          />
        ),
      }),
      columnHelper.accessor("chaosValue", {
        header: "Chaos Value",
        cell: ({ row, getValue }) => (
          <SessionPriceValue
            kind="details"
            value={getValue()}
            hidden={row.original.hidePrice}
          />
        ),
      }),
      columnHelper.accessor("totalValue", {
        header: "Total Value",
        cell: ({ row, getValue }) => (
          <SessionPriceValue
            kind="details"
            value={getValue()}
            hidden={row.original.hidePrice}
            total
          />
        ),
      }),
    ],
    [],
  );

  if (cardData.length === 0) {
    return (
      <div className="card bg-base-200 shadow-xl">
        <div className="card-body">
          <div className="text-center py-12 text-base-content/50">
            <p>No cards in this session</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <div>
          <h2 className="card-title">Cards Obtained</h2>
          <p className="text-sm text-base-content/60">
            Viewing poe.ninja exchange snapshot prices
          </p>
        </div>

        <div className="mt-3">
          <Table
            data={cardData}
            columns={columns}
            enableSorting={true}
            enablePagination={true}
            pageSize={20}
            hoverable={true}
            initialSorting={[{ id: "totalValue", desc: true }]}
          />
        </div>
      </div>
    </div>
  );
};

export default SessionDetailsTable;
