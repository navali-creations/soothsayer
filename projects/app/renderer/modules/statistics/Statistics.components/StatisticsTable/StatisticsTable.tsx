import { useMemo } from "react";
import {
  createCardCountColumn,
  createCardNameColumn,
  createCardRatioColumn,
  Table,
} from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";
import type { CardEntry } from "../../Statistics.types";

interface StatisticsTableProps {
  cardData: CardEntry[];
}

export const StatisticsTable = ({ cardData }: StatisticsTableProps) => {
  const {
    statistics: { statScope },
  } = useBoundStore();

  const columns = useMemo(
    () => [
      createCardNameColumn(),
      createCardCountColumn(),
      createCardRatioColumn(),
    ],
    [],
  );

  return (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">
          Card Collection
          <span className="badge badge-ghost">
            {statScope === "all-time" ? "All-Time" : "League"}
          </span>
        </h2>

        {cardData.length === 0 ? (
          <div className="text-center py-12 text-base-content/50">
            <p className="text-lg">No cards collected yet</p>
            <p className="text-sm">
              Start a session and open divination cards in Path of Exile!
            </p>
          </div>
        ) : (
          <Table
            data={cardData}
            columns={columns}
            enableSorting={true}
            enablePagination={true}
            pageSize={20}
            hoverable={true}
          />
        )}
      </div>
    </div>
  );
};
