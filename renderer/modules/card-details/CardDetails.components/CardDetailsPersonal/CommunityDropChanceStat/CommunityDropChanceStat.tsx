import { Stat } from "~/renderer/components";
import {
  useCommunityDropRate,
  useIsLoadingCommunityDropRate,
} from "~/renderer/store";

import { formatDropChance } from "../CardDetailsPersonal.utils";

const CommunityDropChanceStat = () => {
  const communityDropRate = useCommunityDropRate();
  const isLoadingCommunityDropRate = useIsLoadingCommunityDropRate();
  const dropChance =
    communityDropRate && communityDropRate.sampleSize > 0
      ? formatDropChance(
          communityDropRate.dropCount,
          communityDropRate.sampleSize,
        )
      : null;

  return (
    <Stat
      className="flex-1 basis-1/4"
      title={
        communityDropRate
          ? `Community observations for ${communityDropRate.league}`
          : undefined
      }
    >
      <Stat.Title>Community Drop Chance</Stat.Title>
      <Stat.Value className="text-lg">
        {isLoadingCommunityDropRate ? (
          <span
            className="loading loading-dots loading-sm"
            aria-label="Loading community drop chance"
          />
        ) : (
          (dropChance ?? "—")
        )}
      </Stat.Value>
      <Stat.Desc>
        {communityDropRate && dropChance
          ? `${communityDropRate.dropCount.toLocaleString()} in ${communityDropRate.sampleSize.toLocaleString()} cards`
          : "No community data"}
      </Stat.Desc>
    </Stat>
  );
};

export default CommunityDropChanceStat;
