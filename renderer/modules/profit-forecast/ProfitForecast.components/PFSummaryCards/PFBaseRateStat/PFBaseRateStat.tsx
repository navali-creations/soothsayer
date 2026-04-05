import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiEdit2, FiX } from "react-icons/fi";

import { Stat } from "~/renderer/components";
import { useProfitForecast } from "~/renderer/store";

const PFBaseRateStat = () => {
  const {
    isLoading,
    baseRate,
    baseRateSource,
    customBaseRate,
    snapshotFetchedAt,
    getEffectiveBaseRate,
    getBreakEvenRate,
    hasData,
    setCustomBaseRate,
    setIsComputing,
  } = useProfitForecast();

  // ─── Editing state ─────────────────────────────────────────────────────

  const [isEditingRate, setIsEditingRate] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const dataAvailable = hasData() && !isLoading;
  const effectiveBaseRate = getEffectiveBaseRate();
  const hasCustomRate = customBaseRate !== null;
  const breakEvenRate = dataAvailable ? getBreakEvenRate() : 0;

  const handleStartEditing = useCallback(() => {
    if (isEditingRate) return;
    setEditValue(String(effectiveBaseRate));
    setIsEditingRate(true);
  }, [effectiveBaseRate, isEditingRate]);

  useEffect(() => {
    if (isEditingRate && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingRate]);

  const handleCommitRate = useCallback(() => {
    if (!isEditingRate) return;
    setIsEditingRate(false);

    const parsed = Math.floor(Number(editValue));
    if (Number.isNaN(parsed) || parsed <= 0) return;

    if (parsed === baseRate) {
      if (hasCustomRate) {
        setCustomBaseRate(null);
        setIsComputing(true);
      }
      return;
    }

    if (parsed === customBaseRate) return;

    setCustomBaseRate(parsed);
    setIsComputing(true);
  }, [
    isEditingRate,
    editValue,
    baseRate,
    customBaseRate,
    hasCustomRate,
    setCustomBaseRate,
    setIsComputing,
  ]);

  const handleCancelEditing = useCallback(() => {
    setIsEditingRate(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleCommitRate();
      } else if (e.key === "Escape") {
        handleCancelEditing();
      }
    },
    [handleCommitRate, handleCancelEditing],
  );

  const handleResetRate = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!hasCustomRate) return;
      setCustomBaseRate(null);
      setIsComputing(true);
    },
    [hasCustomRate, setCustomBaseRate, setIsComputing],
  );

  // ─── Derived values ────────────────────────────────────────────────────

  const inputMin = breakEvenRate > 0 ? Math.ceil(breakEvenRate) : 1;
  const inputMax = 110;

  const formattedSnapshotDate = (() => {
    if (!snapshotFetchedAt) return null;
    try {
      const date = new Date(snapshotFetchedAt);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  })();

  return (
    <Stat data-onboarding="pf-base-rate">
      <Stat.Title>
        <span className="inline-flex items-center gap-1.5">
          Base Rate
          {dataAvailable && baseRateSource === "derived" && !hasCustomRate && (
            <span className="badge badge-xs badge-warning">derived</span>
          )}
          {hasCustomRate && (
            <span className="badge badge-xs badge-soft badge-ghost text-primary">
              custom
            </span>
          )}
        </span>
      </Stat.Title>
      <Stat.Value className="text-lg">
        {isEditingRate ? (
          <span className="inline-flex items-center gap-1">
            <input
              ref={inputRef}
              type="number"
              min={inputMin}
              max={inputMax}
              step={1}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleCommitRate}
              onKeyDown={handleKeyDown}
              className="input input-xs input-bordered w-16 text-center font-semibold tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-base-content/50 text-sm">decks/div</span>
          </span>
        ) : dataAvailable && effectiveBaseRate > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className={clsx(hasCustomRate && "text-info")}>
              {effectiveBaseRate} decks/div
            </span>
            <button
              type="button"
              onClick={handleStartEditing}
              className={clsx(
                "tooltip tooltip-bottom inline-flex items-center cursor-pointer",
                "rounded p-0.5 transition-colors",
                "hover:bg-base-300/80",
              )}
              data-tip="Set custom base rate"
            >
              <FiEdit2 className="w-3.5 h-3.5 text-base-content/50 hover:text-base-content/80 transition-colors" />
            </button>
          </span>
        ) : (
          "—"
        )}
      </Stat.Value>
      <Stat.Desc>
        {isEditingRate ? (
          <span className="text-[11px] text-base-content/40">
            {inputMin}&ndash;{inputMax} &middot; Enter to confirm &middot; Esc
            to cancel
          </span>
        ) : hasCustomRate && dataAvailable ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="text-base-content/40 text-[11px]">
              market: {baseRate} decks/div
            </span>
            <button
              type="button"
              onClick={handleResetRate}
              className="badge badge-xs badge-soft badge-info gap-0.5 cursor-pointer select-none hover:brightness-110 transition-all"
              title="Reset to market rate"
            >
              <FiX className="w-2.5 h-2.5" />
              Reset
            </button>
          </span>
        ) : dataAvailable && formattedSnapshotDate ? (
          <span className="text-base-content/50">{formattedSnapshotDate}</span>
        ) : null}
      </Stat.Desc>
    </Stat>
  );
};

export default PFBaseRateStat;
