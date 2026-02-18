import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { useBoundStore } from "~/renderer/store";

const PriceSnapshotAlert = () => {
  const {
    currentSession: { getSession, getSessionInfo },
    settings: { getActiveGameViewPriceSource },
    poeNinja: { currentSnapshot, isAutoRefreshActive, getTimeUntilNextRefresh },
  } = useBoundStore();

  const sessionData = getSession();
  const sessionInfo = getSessionInfo();
  const priceSource = getActiveGameViewPriceSource();

  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);
  const [seconds, setSeconds] = useState(0);

  // Extract game and league from session info
  const game = sessionInfo?.league?.split(":")?.[0] as
    | "poe1"
    | "poe2"
    | undefined;
  const league = sessionInfo?.league?.split(":")?.[1];

  const autoRefreshActive =
    game && league ? isAutoRefreshActive(game, league) : false;

  // Check if we have snapshot data from either the session or the poeNinja slice
  const hasSnapshot = !!sessionData?.priceSnapshot || !!currentSnapshot;

  useEffect(() => {
    if (!autoRefreshActive || !game || !league) {
      setHours(0);
      setMinutes(0);
      setSeconds(0);
      return;
    }

    const updateTimer = () => {
      const timeUntilRefresh = getTimeUntilNextRefresh(game, league);

      if (!timeUntilRefresh || timeUntilRefresh <= 0) {
        setHours(0);
        setMinutes(0);
        setSeconds(0);
        return;
      }

      const h = Math.floor(timeUntilRefresh / (60 * 60 * 1000));
      const m = Math.floor((timeUntilRefresh % (60 * 60 * 1000)) / (60 * 1000));
      const s = Math.floor((timeUntilRefresh % (60 * 1000)) / 1000);

      setHours(h);
      setMinutes(m);
      setSeconds(s);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [autoRefreshActive, game, league, getTimeUntilNextRefresh]);

  // Determine whether an auto-refresh has produced a newer snapshot than the
  // one locked to this session.  We compare timestamps: the session's
  // priceSnapshot.timestamp is set when the session starts, while
  // currentSnapshot.fetchedAt is updated each time auto-refresh fires.
  const raritiesRefreshedAt = useMemo(() => {
    const sessionTimestamp = sessionData?.priceSnapshot?.timestamp;
    const latestTimestamp = currentSnapshot?.fetchedAt;

    if (!sessionTimestamp || !latestTimestamp) return null;

    const sessionTime = new Date(sessionTimestamp).getTime();
    const latestTime = new Date(latestTimestamp).getTime();

    // Only show if the latest snapshot is meaningfully newer (>1 min)
    if (latestTime - sessionTime > 60_000) {
      return latestTimestamp;
    }

    return null;
  }, [sessionData?.priceSnapshot?.timestamp, currentSnapshot?.fetchedAt]);

  // Always derive pricing info from the session's own snapshot — that is what
  // actually prices every card in the table.  Fall back to currentSnapshot
  // only when the session has no snapshot at all (edge-case at startup).
  const chaosToDivineRatio =
    sessionData?.totals?.[priceSource]?.chaosToDivineRatio ||
    (currentSnapshot
      ? priceSource === "exchange"
        ? currentSnapshot.exchangeChaosToDivine
        : currentSnapshot.stashChaosToDivine
      : 0);

  if (hasSnapshot) {
    // Always prefer the session's own snapshot timestamp so the alert
    // accurately reflects what is pricing the cards.
    const snapshotTimestamp =
      sessionData?.priceSnapshot?.timestamp ||
      currentSnapshot?.fetchedAt ||
      new Date().toISOString();


    const displaySnapshotId =
      sessionData?.snapshotId || currentSnapshot?.id || null;

    return (
      <div className="alert alert-soft alert-success bg-base-200">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          className="stroke-current shrink-0 w-6 h-6"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span>
              Using {priceSource} pricing snapshot
              {" from "}
              {new Date(snapshotTimestamp).toLocaleString()}
              {chaosToDivineRatio > 0 && (
                <>
                  {" • Divine = "}
                  {chaosToDivineRatio.toFixed(2)}c
                </>
              )}
            </span>
            {autoRefreshActive && (hours > 0 || minutes > 0 || seconds > 0) ? (
              <span className="flex items-center gap-1">
                • Next refresh in:
                <span className="countdown font-mono text-sm">
                  <span
                    style={{ "--value": hours } as React.CSSProperties}
                    aria-live="polite"
                    aria-label={hours.toString()}
                  >
                    {hours}
                  </span>
                  h
                  <span
                    style={
                      {
                        "--value": minutes,
                        "--digits": 2,
                      } as React.CSSProperties
                    }
                    aria-live="polite"
                    aria-label={minutes.toString()}
                  >
                    {minutes}
                  </span>
                  m
                  <span
                    style={
                      {
                        "--value": seconds,
                        "--digits": 2,
                      } as React.CSSProperties
                    }
                    aria-live="polite"
                    aria-label={seconds.toString()}
                  >
                    {seconds}
                  </span>
                  s
                </span>
              </span>
            ) : autoRefreshActive ? (
              <span className="text-warning">• Refreshing soon...</span>
            ) : null}
          </div>
          <div className="text-xs opacity-70 mt-1 flex items-center gap-2 flex-wrap">
            <span>Use checkboxes to hide anomalous prices</span>
            {displaySnapshotId && (
              <span className="font-mono text-[10px] opacity-50">
                • Snapshot: {displaySnapshotId.substring(0, 8)}...
              </span>
            )}
            {raritiesRefreshedAt && (
              <span className="text-[10px] opacity-50">
                • Rarities updated{" "}
                {new Date(raritiesRefreshedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Only show warning if there's truly no snapshot available anywhere
  return null;
};

export default PriceSnapshotAlert;
