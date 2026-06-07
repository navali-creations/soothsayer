import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit2, FiX } from "react-icons/fi";

import { Stat } from "~/renderer/components";
import { useProfitForecast } from "~/renderer/store";

import { formatDivine } from "../../../ProfitForecast.utils/ProfitForecast.utils";

const PFYouSpendStat = () => {
  const {
    isLoading,
    chaosToDivineRatio,
    customTotalCost,
    getTotalCost,
    getAvgCostPerDeck,
    hasData,
    setCustomTotalCost,
    setIsComputing,
  } = useProfitForecast();

  const [isEditingSpend, setIsEditingSpend] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const dataAvailable = hasData() && !isLoading;
  const totalCost = dataAvailable ? getTotalCost() : 0;
  const avgCostPerDeck = dataAvailable ? getAvgCostPerDeck() : 0;
  const hasCustomSpend = customTotalCost !== null;
  const canEdit = dataAvailable && chaosToDivineRatio > 0;
  const displayValue = dataAvailable
    ? formatDivine(totalCost, chaosToDivineRatio)
    : "—";

  const handleStartEditing = useCallback(() => {
    if (isEditingSpend || !canEdit) return;
    setEditValue((totalCost / chaosToDivineRatio).toFixed(2));
    setIsEditingSpend(true);
  }, [canEdit, chaosToDivineRatio, isEditingSpend, totalCost]);

  useEffect(() => {
    if (isEditingSpend && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingSpend]);

  const handleCommitSpend = useCallback(() => {
    if (!isEditingSpend) return;
    setIsEditingSpend(false);

    const parsedDivines = Number(editValue);
    if (
      Number.isNaN(parsedDivines) ||
      parsedDivines <= 0 ||
      chaosToDivineRatio <= 0
    ) {
      return;
    }

    const nextTotalCost = parsedDivines * chaosToDivineRatio;
    if (nextTotalCost === customTotalCost) return;

    setCustomTotalCost(nextTotalCost);
    setIsComputing(true);
  }, [
    isEditingSpend,
    editValue,
    chaosToDivineRatio,
    customTotalCost,
    setCustomTotalCost,
    setIsComputing,
  ]);

  const handleCancelEditing = useCallback(() => {
    setIsEditingSpend(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCommitSpend();
      } else if (e.key === "Escape") {
        handleCancelEditing();
      }
    },
    [handleCommitSpend, handleCancelEditing],
  );

  const handleResetSpend = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasCustomSpend) return;
      setCustomTotalCost(null);
      setIsComputing(true);
    },
    [hasCustomSpend, setCustomTotalCost, setIsComputing],
  );

  return (
    <Stat>
      <Stat.Title>
        <span className="inline-flex items-center gap-1.5">
          You Spend
          {hasCustomSpend && (
            <span className="badge badge-xs badge-soft badge-ghost text-primary">
              custom
            </span>
          )}
        </span>
      </Stat.Title>
      <Stat.Value className="text-lg">
        {isEditingSpend ? (
          <span className="inline-flex items-center gap-1">
            <input
              ref={inputRef}
              type="number"
              min={0.01}
              step={0.01}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommitSpend}
              onKeyDown={handleKeyDown}
              className="input input-xs input-bordered w-20 text-center font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-base-content/50 text-sm">d</span>
          </span>
        ) : dataAvailable ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={clsx(hasCustomSpend && "text-info")}>
              {displayValue}
            </span>
            {canEdit && (
              <button
                type="button"
                onClick={handleStartEditing}
                className={clsx(
                  "tooltip tooltip-bottom inline-flex items-center cursor-pointer",
                  "rounded p-0.5 transition-colors",
                  "hover:bg-base-300/80",
                )}
                data-tip="Set custom spend"
              >
                <FiEdit2 className="w-3.5 h-3.5 text-base-content/50 hover:text-base-content/80 transition-colors" />
              </button>
            )}
          </span>
        ) : (
          "—"
        )}
      </Stat.Value>
      <Stat.Desc>
        {isEditingSpend ? (
          <span className="text-[11px] text-base-content/40">
            divines &middot; Enter to confirm &middot; Esc to cancel
          </span>
        ) : hasCustomSpend && dataAvailable ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-base-content/40 text-[11px]">
              avg {avgCostPerDeck.toFixed(2)}c / deck
            </span>
            <button
              type="button"
              onClick={handleResetSpend}
              className="badge badge-xs badge-soft badge-info gap-0.5 cursor-pointer select-none hover:brightness-110 transition-all"
              title="Reset to modeled spend"
            >
              <FiX className="w-2.5 h-2.5" />
              Reset
            </button>
          </span>
        ) : dataAvailable ? (
          `avg ${avgCostPerDeck.toFixed(2)}c / deck`
        ) : null}
      </Stat.Desc>
    </Stat>
  );
};

export default PFYouSpendStat;
