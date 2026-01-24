import { useMemo } from "react";

import {
  createCardCountColumn,
  createCardNameColumn,
  Table,
} from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import {
  createCurrentSessionChaosValueColumn,
  createCurrentSessionHidePriceColumn,
  createCurrentSessionRatioColumn,
  createCurrentSessionTotalValueColumn,
} from "./columns";

const CurrentSessionTable = () => {
  const {
    currentSession: { getIsCurrentSessionActive, getSession },
    settings: { getActiveGameViewPriceSource },
  } = useBoundStore();
  const isCurrentSessionActive = getIsCurrentSessionActive();
  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();
  const cardData = sessionData?.cards || [];

  const columns = useMemo(
    () => [
      createCurrentSessionHidePriceColumn(),
      createCardNameColumn(),
      createCardCountColumn(),
      createCurrentSessionRatioColumn(),
      createCurrentSessionChaosValueColumn(priceSource),
      createCurrentSessionTotalValueColumn(priceSource),
    ],
    [priceSource],
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">Cards Opened</h2>

        {cardData.length === 0 ? (
          <div className="text-center py-12 text-base-content/50">
            <p className="text-lg">No cards in this session yet</p>
            <p className="text-sm">
              {isCurrentSessionActive
                ? "Start opening stacked decks in Path of Exile!"
                : "Start a session to begin tracking"}
            </p>
          </div>
        ) : (
          <Table
            key={priceSource}
            data={cardData}
            columns={columns}
            enableSorting={true}
            enablePagination={true}
            pageSize={20}
            hoverable={true}
            initialSorting={[{ id: "totalValue", desc: true }]}
          />
        )}
      </div>
    </div>
  );
};

export default CurrentSessionTable;
