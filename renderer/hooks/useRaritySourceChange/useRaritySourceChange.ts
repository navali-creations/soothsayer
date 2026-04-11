import { useCallback } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useRarityInsights, useSettings } from "~/renderer/store";
import {
  decodeRaritySourceValue,
  getAnalyticsRaritySource,
} from "~/renderer/utils";

/**
 * Shared hook that encapsulates the rarity-source-change logic:
 * decode → updateSetting → trackEvent → selectFilter / clearSelectedFilter.
 *
 * Returns a stable callback `handleRaritySourceChange(encodedValue)`.
 */
export function useRaritySourceChange() {
  const { selectedFilterId, updateSetting } = useSettings();
  const { availableFilters, selectFilter, clearSelectedFilter } =
    useRarityInsights();

  const handleRaritySourceChange = useCallback(
    async (value: string) => {
      const { raritySource: newSource, filterId: newFilterId } =
        decodeRaritySourceValue(value);

      await updateSetting("raritySource", newSource);
      trackEvent("settings-change", {
        setting: "raritySource",
        value: getAnalyticsRaritySource(
          newSource,
          newFilterId,
          availableFilters,
        ),
      });

      if (newSource === "filter" && newFilterId) {
        await selectFilter(newFilterId);
        await updateSetting("selectedFilterId", newFilterId);
      } else {
        if (selectedFilterId) {
          await clearSelectedFilter();
          await updateSetting("selectedFilterId", null);
        }
      }
    },
    [
      updateSetting,
      selectFilter,
      clearSelectedFilter,
      selectedFilterId,
      availableFilters,
    ],
  );

  return handleRaritySourceChange;
}
