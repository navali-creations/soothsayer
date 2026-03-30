import { createFileRoute } from "@tanstack/react-router";

import { useBoundStore } from "~/renderer/store";

import StatisticsPage from "../modules/statistics/Statistics.page";

export const Route = createFileRoute("/statistics")({
  loader: async () => {
    const { statistics, settings } = useBoundStore.getState();
    const { statScope, selectedLeague } = statistics;

    // Anticipate the league-seeding effect that runs on first mount:
    // if the global AppMenu has a selected league the page will switch
    // to league scope, so we perform that seeding here in the loader.
    // The page's seeding effect checks `hasSeeded` via a ref, but since
    // it hasn't mounted yet, we seed the store directly so the effect
    // sees the already-seeded state and becomes a no-op.
    const globalLeague = settings.getActiveGameViewSelectedLeague();

    let effectiveScope = statScope;
    let effectiveLeague =
      statScope === "league" && selectedLeague ? selectedLeague : undefined;

    if (globalLeague && statScope === "all-time") {
      effectiveScope = "league";
      effectiveLeague = globalLeague;

      // Seed the store so the page's seeding useEffect is a no-op
      statistics.setSelectedLeague(globalLeague);
      statistics.setStatScope("league");
    }

    // Fetch available leagues first so we can validate the effective league.
    // This is a fast local SQLite query so serialising it doesn't hurt.
    await statistics.fetchAvailableLeagues("poe1");

    // Re-read availableLeagues after the fetch completes
    const { availableLeagues } = useBoundStore.getState().statistics;

    // If the effective league is not in the available leagues, fall back to
    // the first available league (mirrors the page's fallback useEffect).
    if (
      effectiveScope === "league" &&
      effectiveLeague &&
      availableLeagues.length > 0 &&
      !availableLeagues.includes(effectiveLeague)
    ) {
      effectiveLeague = availableLeagues[0];
      statistics.setSelectedLeague(effectiveLeague);
    }

    const league =
      effectiveScope === "league" && effectiveLeague
        ? effectiveLeague
        : undefined;

    // Fire all remaining data fetches in parallel — these populate the
    // Zustand store.  By the time the user clicks and the component mounts,
    // data is already in the store so there are no loading spinners.
    await Promise.all([
      statistics.fetchSessionHighlights("poe1", league),
      statistics.fetchChartData("poe1", league),
      statistics.fetchDivinationCards("poe1", effectiveScope, league),
    ]);
  },
  component: StatisticsPage,
});
