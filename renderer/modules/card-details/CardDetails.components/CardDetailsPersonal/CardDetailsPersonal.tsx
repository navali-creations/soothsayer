import { GroupedStats, Stat } from "~/renderer/components";
import { useCardDetails } from "~/renderer/store";

import { formatRelativeDate } from "../../helpers";
import { formatDropChance } from "./CardDetailsPersonal.utils";
import CommunityDropChanceStat from "./CommunityDropChanceStat/CommunityDropChanceStat";
import PersonalStatsError from "./PersonalStatsError";
import PersonalStatsNeverFound from "./PersonalStatsNeverFound";
import PersonalStatsPlaceholder from "./PersonalStatsPlaceholder";

const CardDetailsPersonal = () => {
  const { personalAnalytics, personalAnalyticsError } = useCardDetails();
  const lastSeen = personalAnalytics?.lastSeenAt
    ? formatRelativeDate(personalAnalytics.lastSeenAt)
    : null;

  const totalLifetimeDrops = personalAnalytics?.totalLifetimeDrops ?? 0;
  const totalDecksOpenedAllSessions =
    personalAnalytics?.totalDecksOpenedAllSessions ?? 0;

  return (
    <div className="space-y-3">
      <GroupedStats className="w-full">
        <CommunityDropChanceStat />
        {!personalAnalytics || personalAnalyticsError ? (
          <PersonalStatsPlaceholder />
        ) : (
          <>
            <Stat className="flex-1 basis-1/4">
              <Stat.Title>Your Drop Chance</Stat.Title>
              <Stat.Value className="text-lg">
                {totalDecksOpenedAllSessions > 0
                  ? formatDropChance(
                      totalLifetimeDrops,
                      totalDecksOpenedAllSessions,
                    )
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

            <Stat className="flex-1 basis-1/4">
              <Stat.Title>Total Drops</Stat.Title>
              <Stat.Value className="text-lg">
                {totalLifetimeDrops.toLocaleString()}
              </Stat.Value>
              <Stat.Desc>Across all sessions</Stat.Desc>
            </Stat>

            <Stat
              className="flex-1 basis-1/4"
              title={personalAnalytics.lastSeenAt ?? undefined}
            >
              <Stat.Title>Last Seen</Stat.Title>
              <Stat.Value className="text-lg">
                {lastSeen?.relative ?? "—"}
              </Stat.Value>
              <Stat.Desc>{lastSeen?.absolute ?? "\u00a0"}</Stat.Desc>
            </Stat>
          </>
        )}
      </GroupedStats>
      {personalAnalyticsError && (
        <PersonalStatsError message={personalAnalyticsError} />
      )}
      {personalAnalytics?.totalLifetimeDrops === 0 && (
        <PersonalStatsNeverFound />
      )}
    </div>
  );
};

export default CardDetailsPersonal;
