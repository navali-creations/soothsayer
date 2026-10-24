import { LuWeight } from "react-icons/lu";
import { TbEyeSearch } from "react-icons/tb";

import { Stat } from "~/renderer/components";
import {
  useCommunityDropRate,
  useIsLoadingCommunityDropRate,
} from "~/renderer/store";

import { formatDropProbability } from "../CardDetailsPersonal.utils";

const CommunityDropChanceStat = () => {
  const communityDropRate = useCommunityDropRate();
  const isLoadingCommunityDropRate = useIsLoadingCommunityDropRate();
  const referenceDropChance =
    communityDropRate?.referenceDropChance != null
      ? formatDropProbability(communityDropRate.referenceDropChance)
      : null;
  const observationTooltip = communityDropRate
    ? `${communityDropRate.dropCount.toLocaleString()} drops of this card were reported in the ${communityDropRate.sampleSize.toLocaleString()}-card ${communityDropRate.league} community sample.`
    : undefined;
  const referenceWeightTooltip = communityDropRate
    ? communityDropRate.referenceWeight === null
      ? `No reference weight is available for this card in ${communityDropRate.league}.`
      : `Reference weight: ${communityDropRate.referenceWeight.toLocaleString()}. Higher weights mean the card is expected to appear more often.`
    : undefined;

  return (
    <Stat className="flex-1 basis-1/4">
      <Stat.Title>Estimated Drop Chance</Stat.Title>
      <Stat.Value className="text-lg">
        {isLoadingCommunityDropRate ? (
          <span
            className="loading loading-dots loading-sm"
            aria-label="Loading community drop chance"
          />
        ) : (
          (referenceDropChance ?? "—")
        )}
      </Stat.Value>
      <Stat.Desc className="flex items-center gap-3">
        {communityDropRate ? (
          <>
            <span
              aria-label={`${communityDropRate.dropCount.toLocaleString()} community observations for ${communityDropRate.league}`}
              className="tooltip tooltip-top tooltip-primary inline-flex items-center gap-1"
              data-tip={observationTooltip}
            >
              <TbEyeSearch aria-hidden="true" />
              <span>{communityDropRate.dropCount.toLocaleString()}</span>
            </span>
            <span
              aria-label={
                communityDropRate.referenceWeight === null
                  ? `No reference weight for ${communityDropRate.league}`
                  : `Reference weight ${communityDropRate.referenceWeight.toLocaleString()} for ${communityDropRate.league}`
              }
              className="tooltip tooltip-top tooltip-primary inline-flex items-center gap-1"
              data-tip={referenceWeightTooltip}
            >
              <LuWeight aria-hidden="true" />
              <span>
                {communityDropRate.referenceWeight?.toLocaleString() ?? "—"}
              </span>
            </span>
          </>
        ) : (
          "No community data"
        )}
      </Stat.Desc>
    </Stat>
  );
};

export default CommunityDropChanceStat;
