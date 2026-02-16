import type { CellContext } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useId, useMemo } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

import { DivinationCard, Table } from "~/renderer/components";
import { usePopover } from "~/renderer/hooks/usePopover";
import { useBoundStore } from "~/renderer/store";
import { formatCurrency } from "~/renderer/utils";
import type { CardEntry as GlobalCardEntry } from "~/types/data-stores";

import type { CardEntry } from "../../SessionDetails.types";

// Card name cell with popover
const SessionCardNameCell = ({
  info,
}: {
  info: CellContext<CardEntry, string>;
}) => {
  const popoverId = useId();
  const row = info.row.original;
  const isHidden = row.hidePrice || false;
  const hasCardData = !!row.divinationCard;

  const { triggerRef, popoverRef } = usePopover({
    placement: "right",
    offset: 8,
    scale: 0.75,
  });

  // Convert to GlobalCardEntry format for DivinationCard component
  const cardEntry: GlobalCardEntry | null = hasCardData
    ? {
        name: row.name,
        count: row.count,
        processedIds: [],
        divinationCard: row.divinationCard,
      }
    : null;

  return (
    <>
      <span
        ref={hasCardData ? triggerRef : null}
        className={`font-semibold ${
          isHidden ? "opacity-40 line-through" : ""
        } ${hasCardData ? "cursor-help underline decoration-dotted" : ""}`}
      >
        {info.getValue()}
        {isHidden && (
          <span className="badge badge-error badge-xs ml-2">Hidden</span>
        )}
      </span>

      {hasCardData && cardEntry && (
        <div
          id={popoverId}
          ref={popoverRef}
          popover="manual"
          className="p-0 border-0 bg-transparent"
        >
          <DivinationCard card={cardEntry} />
        </div>
      )}
    </>
  );
};

interface SessionDetailsTableProps {
  cardData: CardEntry[];
  chaosToDivineRatio: number;
  priceSource: "exchange" | "stash";
}

const columnHelper = createColumnHelper<CardEntry>();

const SessionDetailsTable = ({
  cardData,
  chaosToDivineRatio,
  priceSource,
}: SessionDetailsTableProps) => {
  const {
    sessionDetails: { toggleCardPriceVisibility },
  } = useBoundStore();

  const columns = useMemo(
    () => [
      // Visibility toggle column
      columnHelper.display({
        id: "visibility",
        header: () => (
          <div
            className="tooltip tooltip-right"
            data-tip="Toggle price visibility (affects totals)"
          >
            <FiEye className="opacity-50" />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;

          return (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => toggleCardPriceVisibility(row.name, priceSource)}
              title={
                isHidden
                  ? "Click to include in totals"
                  : "Click to exclude from totals"
              }
            >
              {isHidden ? (
                <FiEyeOff className="text-error" />
              ) : (
                <FiEye className="text-success" />
              )}
            </button>
          );
        },
      }),
      columnHelper.accessor("name", {
        header: "Card Name",
        cell: (info) => <SessionCardNameCell info={info} />,
      }),
      columnHelper.accessor("count", {
        header: "Count",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          return (
            <div className={`badge badge-soft ${isHidden ? "opacity-40" : ""}`}>
              {info.getValue()}
            </div>
          );
        },
      }),
      columnHelper.accessor("ratio", {
        header: () => (
          <div
            className="tooltip tooltip-right tooltip-primary"
            data-tip="How often this card appeared compared to all other cards"
          >
            Ratio
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          return (
            <span className={`tabular-nums ${isHidden ? "opacity-40" : ""}`}>
              {info.getValue().toFixed(2)}%
            </span>
          );
        },
      }),
      columnHelper.accessor("chaosValue", {
        header: "Chaos Value",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          const value = info.getValue();
          return (
            <span
              className={`tabular-nums ${isHidden ? "opacity-40" : ""} ${
                value === 0 ? "text-base-content/30" : ""
              }`}
            >
              {value === 0 ? "—" : formatCurrency(value, chaosToDivineRatio)}
            </span>
          );
        },
      }),
      columnHelper.accessor("totalValue", {
        header: "Total Value",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          const value = info.getValue();
          return (
            <span
              className={`font-semibold tabular-nums ${
                isHidden ? "opacity-40" : "text-success"
              } ${value === 0 ? "text-base-content/30" : ""}`}
            >
              {value === 0 ? "—" : formatCurrency(value, chaosToDivineRatio)}
            </span>
          );
        },
      }),
    ],
    [chaosToDivineRatio, priceSource, toggleCardPriceVisibility],
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
        <h2 className="card-title">Cards Obtained</h2>
        <p className="text-sm text-base-content/60 mb-3">
          Viewing {priceSource === "exchange" ? "Exchange" : "Stash"} prices
          (Snapshot)
        </p>

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
  );
};

export default SessionDetailsTable;
