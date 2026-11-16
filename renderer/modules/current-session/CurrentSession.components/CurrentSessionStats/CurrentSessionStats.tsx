import clsx from "clsx";

import { GroupedStats } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import CardPriceThresholdInput from "../CardPriceThresholdInput/CardPriceThresholdInput";
import StackedDeckPriceInput from "../StackedDeckPriceInput/StackedDeckPriceInput";
import {
  CurrentSessionMostValueableCardStat,
  CurrentSessionNetProfitStat,
  CurrentSessionOpenedDecksStat,
  CurrentSessionTotalValueStat,
} from ".";

interface CurrentSessionStatsProps {
  expanded?: boolean;
  onToggleExpanded?: () => void;
  hasTimeline?: boolean;
}

const CurrentSessionStats = ({
  expanded,
  onToggleExpanded,
  hasTimeline,
}: CurrentSessionStatsProps) => {
  const isActive = useBoundStore((state) =>
    state.currentSession.getIsCurrentSessionActive(),
  );
  const deckPriceError = useBoundStore(
    (state) =>
      state.currentSession.stackedDeckPriceErrors[state.settings.selectedGame],
  );

  return (
    <div
      className={clsx("grid gap-6 [&_.stat-value]:text-2xl [&_.stat]:px-4", {
        "grid-cols-[minmax(0,2fr)_minmax(0,1fr)]": isActive,
        "grid-cols-[minmax(0,4fr)_minmax(0,1fr)]": !isActive,
      })}
    >
      <GroupedStats
        role="group"
        aria-label="Session statistics"
        className="w-full min-w-0 grid-cols-4"
      >
        <CurrentSessionOpenedDecksStat />
        <CurrentSessionMostValueableCardStat />
        <CurrentSessionTotalValueStat />
        <CurrentSessionNetProfitStat
          expanded={expanded}
          onToggleExpanded={onToggleExpanded}
          hasTimeline={hasTimeline}
        />
      </GroupedStats>
      <GroupedStats
        role="group"
        aria-label="Session pricing controls"
        className={clsx("session-pricing-controls w-full min-w-0", {
          "grid-cols-2": isActive,
          "grid-cols-1": !isActive,
        })}
      >
        <CardPriceThresholdInput />
        {isActive && <StackedDeckPriceInput />}
      </GroupedStats>
      {!isActive && deckPriceError && (
        <p role="alert" className="col-span-full text-xs text-error">
          {deckPriceError} Start a session to retry.
        </p>
      )}
    </div>
  );
};

export default CurrentSessionStats;
