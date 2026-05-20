import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { FiPlay, FiRefreshCw } from "react-icons/fi";

import {
  AnimatedStopIcon,
  Button,
  Flex,
  type RaritySourceGroup,
  type RaritySourceOption,
  RaritySourceSelect,
} from "~/renderer/components";
import { useRaritySourceChange } from "~/renderer/hooks/useRaritySourceChange/useRaritySourceChange";
import {
  useCurrentSession,
  useRarityInsights,
  useSettings,
} from "~/renderer/store";
import { encodeRaritySourceValue } from "~/renderer/utils";

import { DatasetMenuLabel } from "./DatasetMenuLabel/DatasetMenuLabel";

const noop = () => {};

const CurrentSessionActions = () => {
  const { getIsCurrentSessionActive, isLoading, startSession, stopSession } =
    useCurrentSession();
  const { raritySource, selectedFilterId } = useSettings();
  const {
    isScanning,
    lastScannedAt,
    scanFilters,
    getLocalFilters,
    getOnlineFilters,
  } = useRarityInsights();
  const handleDropdownChange = useRaritySourceChange();

  const isActive = getIsCurrentSessionActive();
  const localFilters = getLocalFilters();
  const onlineFilters = getOnlineFilters();

  const dropdownValue = encodeRaritySourceValue(raritySource, selectedFilterId);

  const groups = useMemo<RaritySourceGroup[]>(() => {
    const result: RaritySourceGroup[] = [
      {
        label: "Dataset Driven",
        options: [
          {
            value: "poe.ninja",
            label: "poe.ninja",
            menuLabel: (
              <DatasetMenuLabel
                label="poe.ninja"
                hint="Price based rarity from poe.ninja market data"
              />
            ),
          },
          {
            value: "prohibited-library",
            label: "Prohibited Library",
            menuLabel: (
              <DatasetMenuLabel
                label="Prohibited Library"
                hint="Weight based rarity from community-collected drop data"
              />
            ),
          },
        ],
      },
    ];

    // Build filter options from discovered filters
    const filterOptions: RaritySourceOption[] = [
      ...onlineFilters.map((filter) => ({
        value: `filter:${filter.id}`,
        label: filter.name,
        outdated: filter.isOutdated,
      })),
      ...localFilters.map((filter) => ({
        value: `filter:${filter.id}`,
        label: filter.name,
        outdated: filter.isOutdated,
      })),
    ];

    // Always show the Loot Filters group — with a scan action when
    // filters haven't been scanned yet or need to be rescanned.
    const needsScan = !lastScannedAt && !isScanning;
    result.push({
      label: "Loot Filters",
      options: filterOptions,
      action: needsScan
        ? {
            label: "Scan for filters",
            onClick: scanFilters,
            icon: <FiRefreshCw className="w-3 h-3" />,
          }
        : isScanning
          ? {
              label: "Scanning...",
              onClick: noop,
              loading: true,
              loadingLabel: "Scanning...",
            }
          : filterOptions.length === 0
            ? {
                label: "Rescan filters",
                onClick: scanFilters,
                icon: <FiRefreshCw className="w-3 h-3" />,
              }
            : undefined,
    });

    return result;
  }, [onlineFilters, localFilters, lastScannedAt, isScanning, scanFilters]);

  return (
    <Flex className="gap-2 items-center">
      {/* Unified Rarity Source Dropdown */}
      <div data-onboarding="current-session-rarity-source">
        <RaritySourceSelect
          value={dropdownValue}
          onChange={handleDropdownChange}
          groups={groups}
          disabled={isActive}
          width="w-48"
        />
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
                className="w-[137px]"
              >
                <AnimatedStopIcon />
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
                className="w-[137px]"
              >
                <FiPlay /> Start Session
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Flex>
  );
};

export default CurrentSessionActions;
