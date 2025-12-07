import {
  type GameVersion,
  SettingsKey,
} from "../../../../electron/modules/settings-store/SettingsStore.schemas";
import { useBoundStore } from "../../../store/store";

type LeagueSelectProps = {
  game: Extract<GameVersion, "poe1" | "poe2">;
};

const LeagueSelect = ({ game }: LeagueSelectProps) => {
  const {
    gameInfo: { getLeaguesForGame },
    settings: { getSelectedPoe1League, getSelectedPoe2League, updateSetting },
  } = useBoundStore();
  const poeLeague = getLeaguesForGame(game);
  const selectedLeague =
    game === "poe1" ? getSelectedPoe1League() : getSelectedPoe2League();

  const handleLeagueChange = async (game: string) => {
    const key =
      game === "poe1"
        ? SettingsKey.SelectedPoe1League
        : SettingsKey.SelectedPoe2League;
    await updateSetting(key, selectedLeague);
  };

  return (
    <label className="select select-xs w-[160px] no-drag">
      <span className="label">League</span>
      <select
        value={selectedLeague}
        onChange={(e) => handleLeagueChange(e.target.value)}
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
