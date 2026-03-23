import { useEffect, useRef } from "react";

import { useBoundStore } from "~/renderer/store";

type LeagueSelectProps = {
  game: "poe1" | "poe2";
};

const LeagueSelect = ({ game }: LeagueSelectProps) => {
  const {
    gameInfo: { getLeaguesForGame },
    settings: { getSelectedPoe1League, getSelectedPoe2League, updateSetting },
  } = useBoundStore();
  const poeLeague = getLeaguesForGame(game);
  const selectedLeague =
    game === "poe1" ? getSelectedPoe1League() : getSelectedPoe2League();

  // Track whether we've already auto-corrected to avoid loops.
  // Stores the league value that was corrected FROM, so we reset
  // naturally when the selected league changes (user action or hydration).
  const correctedFromRef = useRef<string | null>(null);

  // Validate that the stored league exists in the available leagues list.
  // If it doesn't (e.g. after a DB reset, hydration failure, or league rotation),
  // auto-select the first available league to keep the dropdown and store in sync.
  useEffect(() => {
    if (poeLeague.length === 0) {
      // Leagues haven't loaded yet — nothing to validate against
      return;
    }

    // Reset correction tracking if the selected league changed
    // (e.g. user picked a different league, or hydration completed)
    if (
      correctedFromRef.current !== null &&
      correctedFromRef.current !== selectedLeague
    ) {
      correctedFromRef.current = null;
    }

    const isSelectedLeagueAvailable = poeLeague.some(
      (league) => league.id === selectedLeague,
    );

    if (
      !isSelectedLeagueAvailable &&
      correctedFromRef.current !== selectedLeague
    ) {
      const fallback = poeLeague[0];
      console.warn(
        `[LeagueSelect] Stored league "${selectedLeague}" for ${game} is not in the available leagues list ` +
          `[${poeLeague.map((l) => l.id).join(", ")}]. Auto-selecting "${
            fallback.id
          }".`,
      );
      correctedFromRef.current = selectedLeague;
      const key = game === "poe1" ? "poe1SelectedLeague" : "poe2SelectedLeague";
      updateSetting(key, fallback.id);
    }
  }, [poeLeague, selectedLeague, game, updateSetting]);

  const handleLeagueChange = async (league: string) => {
    const key = game === "poe1" ? "poe1SelectedLeague" : "poe2SelectedLeague";
    await updateSetting(key, league);
  };

  return (
    <label className="select select-xs w-max no-drag">
      <span className="label">League</span>
      <select
        value={selectedLeague}
        onChange={(e) => handleLeagueChange(e.target.value)}
        className="-me-[30px] -ms-[18px]"
      >
        {poeLeague.map((league) => (
          <option key={league.id} value={league.id}>
            {league.name}
          </option>
        ))}
      </select>
    </label>
  );
};

export default LeagueSelect;
