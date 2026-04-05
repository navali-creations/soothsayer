import { GroupedStats, Stat } from "~/renderer/components";
import { useCardDetails } from "~/renderer/store";

import { formatRelativeDate } from "../../helpers";
import PersonalStatsError from "./PersonalStatsError";
import PersonalStatsNeverFound from "./PersonalStatsNeverFound";
import PersonalStatsPlaceholder from "./PersonalStatsPlaceholder";

const CardDetailsPersonal = () => {
  const { personalAnalytics, personalAnalyticsError } = useCardDetails();

  if (personalAnalyticsError) {
    return <PersonalStatsError message={personalAnalyticsError} />;
  }

  if (!personalAnalytics) {
    return <PersonalStatsPlaceholder />;
  }

  const {
    totalLifetimeDrops,
    firstDiscoveredAt,
    lastSeenAt,
    totalDecksOpenedAllSessions,
  } = personalAnalytics;

  if (totalLifetimeDrops === 0) {
    return <PersonalStatsNeverFound />;
  }

  const firstFound = firstDiscoveredAt
    ? formatRelativeDate(firstDiscoveredAt)
    : null;
  const lastSeen = lastSeenAt ? formatRelativeDate(lastSeenAt) : null;

  return (
    <GroupedStats className="w-full">
      {/* Total Drops */}
      <Stat className="flex-1 basis-1/4">
        <Stat.Title>Total Drops</Stat.Title>
        <Stat.Value className="text-lg">
          {totalLifetimeDrops.toLocaleString()}
        </Stat.Value>
        <Stat.Desc>Across all sessions</Stat.Desc>
      </Stat>

      {/* Drop Rate */}
      <Stat className="flex-1 basis-1/4">
        <Stat.Title>Drop Rate</Stat.Title>
        <Stat.Value className="text-lg">
          {totalDecksOpenedAllSessions > 0
            ? (() => {
                const rate =
                  (totalLifetimeDrops / totalDecksOpenedAllSessions) * 100;
                // Always use fixed decimal format — find the first
                // significant digit and show 2 digits after it.
                if (rate >= 1) return `${rate.toFixed(2)}%`;
                if (rate === 0) return "0%";
                // Count leading zeros after the decimal point
                const leadingZeros = Math.max(0, Math.floor(-Math.log10(rate)));
                return `${rate.toFixed(leadingZeros + 2)}%`;
              })()
            : "—"}
        </Stat.Value>
        <Stat.Desc>
          {totalDecksOpenedAllSessions > 0
            ? `${totalLifetimeDrops.toLocaleString()} in ${Math.floor(
                totalDecksOpenedAllSessions,
              ).toLocaleString()} cards`
            : "Drops per cards opened"}
        </Stat.Desc>
      </Stat>

      {/* First Found */}
      {firstFound && (
        <Stat
          className="flex-1 basis-1/4"
          title={firstDiscoveredAt ?? undefined}
        >
          <Stat.Title>First Found</Stat.Title>
          <Stat.Value className="text-lg">{firstFound.relative}</Stat.Value>
          <Stat.Desc>{firstFound.absolute}</Stat.Desc>
        </Stat>
      )}

      {/* Last Seen */}
      {lastSeen && (
        <Stat className="flex-1 basis-1/4" title={lastSeenAt ?? undefined}>
          <Stat.Title>Last Seen</Stat.Title>
          <Stat.Value className="text-lg">{lastSeen.relative}</Stat.Value>
          <Stat.Desc>{lastSeen.absolute}</Stat.Desc>
        </Stat>
      )}
    </GroupedStats>
  );
};

export default CardDetailsPersonal;
