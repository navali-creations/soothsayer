import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect } from "react";
import { FiPlay } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";

import { Button, Flex } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import {
  decodeRaritySourceValue,
  encodeRaritySourceValue,
  getAnalyticsRaritySource,
} from "~/renderer/utils";

const CurrentSessionActions = () => {
  const {
    currentSession: {
      getIsCurrentSessionActive,
      isLoading,
      startSession,
      stopSession,
    },
    settings: {
      raritySource,
      selectedFilterId,
      updateSetting,
      getActiveGameViewPriceSource,
      setActiveGameViewPriceSource,
    },
    rarityModel: {
      availableFilters,
      isScanning,
      scanFilters,
      selectFilter,
      clearSelectedFilter,
      getLocalFilters,
      getOnlineFilters,
    },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  const priceSource = getActiveGameViewPriceSource();
  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  // Lazy scan: if no filters loaded yet, scan on mount
  useEffect(() => {
    if (availableFilters.length === 0 && !isScanning) {
      scanFilters();
    }
  }, [availableFilters.length, isScanning, scanFilters]);

  const handlePriceSourceChange = async (source: "exchange" | "stash") => {
    await setActiveGameViewPriceSource(source);
  };

  const handleDropdownChange = useCallback(
    async (value: string) => {
      const { raritySource: newSource, filterId: newFilterId } =
        decodeRaritySourceValue(value);

      // Update rarity source setting
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

  const dropdownValue = encodeRaritySourceValue(raritySource, selectedFilterId);

  return (
    <Flex className="gap-2 items-center">
      {/* Unified Rarity Source Dropdown */}
      <div data-onboarding="current-session-rarity-source">
        <select
          className="select select-bordered select-sm w-48"
          value={dropdownValue}
          onChange={(e) => handleDropdownChange(e.target.value)}
          disabled={isActive || isScanning}
          title={
            isActive
              ? "Cannot change rarity source while session is active"
              : "Select rarity source"
          }
        >
          {/* Dataset-driven sources */}
          <optgroup label="Dataset Driven">
            <option value="poe.ninja">poe.ninja (price-based)</option>
            <option value="prohibited-library" disabled>
              Prohibited Library (coming soon)
            </option>
          </optgroup>

          {/* Online filters */}
          {onlineFilters.length > 0 && (
            <optgroup label="Online Filters">
              {onlineFilters.map((filter) => (
                <option key={filter.id} value={`filter:${filter.id}`}>
                  {filter.name}
                  {filter.isOutdated ? " (outdated)" : ""}
                </option>
              ))}
            </optgroup>
          )}

          {/* Local filters */}
          {localFilters.length > 0 && (
            <optgroup label="Local Filters">
              {localFilters.map((filter) => (
                <option key={filter.id} value={`filter:${filter.id}`}>
                  {filter.name}
                  {filter.isOutdated ? " (outdated)" : ""}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div data-onboarding="start-session" className="relative">
        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
            >
              <Button variant="ghost" disabled>
                <span className="mt-0.5 mr-1 loading loading-spinner loading-xs" />
                Starting session...
              </Button>
            </motion.div>
          ) : isActive ? (
            <motion.div
              key="stop"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
            >
              <Button
                variant="ghost"
                onClick={stopSession}
                disabled={isLoading}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4">
                  <rect
                    className="
                      stroke-current
                      stroke-3
                      fill-none
                      [stroke-linecap:butt]
                      [stroke-dasharray:42_8]
                      animate-stop-session
                    "
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                    pathLength="100"
                  />
                </svg>
                Stop Session
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="start"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.1, ease: "easeInOut" }}
            >
              <Button
                variant="ghost"
                onClick={startSession}
                disabled={isLoading}
              >
                <FiPlay /> Start Session
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Price Source Toggle */}
      <div
        role="tablist"
        className="tabs tabs-border"
        data-onboarding="current-session-pricing"
      >
        <button
          role="tab"
          className={`tab flex flex-row items-center gap-1 ${
            priceSource === "exchange" ? "tab-active" : ""
          }`}
          onClick={() => handlePriceSourceChange("exchange")}
        >
          <GiCardExchange />
          Exchange
        </button>
        <button
          role="tab"
          className={`tab flex flex-row items-center gap-1 ${
            priceSource === "stash" ? "tab-active" : ""
          }`}
          onClick={() => handlePriceSourceChange("stash")}
        >
          <GiLockedChest />
          Stash
        </button>
      </div>
    </Flex>
  );
};

export default CurrentSessionActions;
