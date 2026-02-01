import { useEffect } from "react";

import { useBoundStore } from "~/renderer/store";

interface LeagueDropdownProps {
  label: string;
  currentLeague: string;
  leagues: Array<{ id: string; name: string }>;
  isLoading: boolean;
  error: string | null;
  onLeagueChange: (league: string) => void;
  onRetry: () => void;
}

const LeagueDropdown = ({
  label,
  currentLeague,
  leagues,
  isLoading,
  error,
  onLeagueChange,
  onRetry,
}: LeagueDropdownProps) => {
  return (
    <div className="mb-4">
      <label className="label py-1">
        <span className="label-text text-sm text-base-content">{label}</span>
      </label>

      {error && (
        <div className="flex items-center gap-2 mb-2 text-error text-sm">
          <span>Failed to load leagues</span>
          <button onClick={onRetry} className="btn btn-ghost btn-xs">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 px-3 py-2 bg-base-100 border border-base-content/20 rounded-lg text-base-content/60 text-sm">
          <span className="loading loading-spinner loading-xs" />
          <span>Loading...</span>
        </div>
      ) : (
        <select
          value={currentLeague}
          onChange={(e) => onLeagueChange(e.target.value)}
          className="select select-bordered select-sm w-full"
        >
          <option value="" disabled>
            Select a league...
          </option>
          {leagues.map((league) => (
            <option key={league.id} value={league.id}>
              {league.name}
            </option>
          ))}
        </select>
      )}

      {!isLoading && leagues.length === 0 && !error && (
        <p className="mt-1 text-xs text-base-content/50">
          No leagues available.
        </p>
      )}
    </div>
  );
};

const SetupLeagueStep = () => {
  const {
    setup: { setupState, selectLeague },
    gameInfo: {
      poe1Leagues,
      poe2Leagues,
      isLoadingLeagues,
      leaguesError,
      fetchLeagues,
    },
  } = useBoundStore();

  const selectedGames = setupState?.selectedGames || [];
  const poe1League = setupState?.poe1League || "";
  const poe2League = setupState?.poe2League || "";

  const hasPoe1 = selectedGames.includes("poe1");
  const hasPoe2 = selectedGames.includes("poe2");
  const hasBoth = hasPoe1 && hasPoe2;

  // Fetch leagues when this step is shown
  useEffect(() => {
    if (hasPoe1) {
      fetchLeagues("poe1");
    }
    if (hasPoe2) {
      fetchLeagues("poe2");
    }
  }, [hasPoe1, hasPoe2, fetchLeagues]);

  const handlePoe1LeagueChange = (league: string) => {
    selectLeague("poe1", league);
  };

  const handlePoe2LeagueChange = (league: string) => {
    selectLeague("poe2", league);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-base-content mb-1">
        Select your league
      </h2>

      <p className="text-sm text-base-content/60 mb-4">
        Choose the league you want to track divination cards for.
      </p>

      {hasPoe1 && (
        <LeagueDropdown
          label="Path of Exile 1 League"
          currentLeague={poe1League}
          leagues={poe1Leagues}
          isLoading={isLoadingLeagues}
          error={leaguesError}
          onLeagueChange={handlePoe1LeagueChange}
          onRetry={() => fetchLeagues("poe1")}
        />
      )}

      {hasPoe2 && (
        <LeagueDropdown
          label="Path of Exile 2 League"
          currentLeague={poe2League}
          leagues={poe2Leagues}
          isLoading={isLoadingLeagues}
          error={leaguesError}
          onLeagueChange={handlePoe2LeagueChange}
          onRetry={() => fetchLeagues("poe2")}
        />
      )}

      {hasBoth && poe1League && poe2League && (
        <p className="text-xs text-success mt-2">✓ Both leagues configured</p>
      )}
    </div>
  );
};

export default SetupLeagueStep;
