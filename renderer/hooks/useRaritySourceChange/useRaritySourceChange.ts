import { useCallback } from "react";

import { useRarityInsights, useSettings } from "~/renderer/store";
import { decodeRaritySourceValue } from "~/renderer/utils";

/**
 * Shared hook that encapsulates the rarity-source-change logic:
 * decode → updateSetting → selectFilter / clearSelectedFilter.
 *
 * Returns a stable callback `handleRaritySourceChange(encodedValue)`.
 */
export function useRaritySourceChange() {
  const { selectedFilterId, updateSetting } = useSettings();
  const { selectFilter, clearSelectedFilter, clearFilterTheme } =
    useRarityInsights();

  const handleRaritySourceChange = useCallback(
    async (value: string) => {
      const { raritySource: newSource, filterId: newFilterId } =
        decodeRaritySourceValue(value);

      await updateSetting("raritySource", newSource);

      if (newSource === "filter" && newFilterId) {
        await selectFilter(newFilterId);
        await updateSetting("selectedFilterId", newFilterId);
      } else {
        if (selectedFilterId) {
          await clearSelectedFilter();
          await updateSetting("selectedFilterId", null);
        } else {
          clearFilterTheme();
        }
      }
    },
    [
      updateSetting,
      selectFilter,
      clearSelectedFilter,
      clearFilterTheme,
      selectedFilterId,
    ],
  );

  return handleRaritySourceChange;
}
