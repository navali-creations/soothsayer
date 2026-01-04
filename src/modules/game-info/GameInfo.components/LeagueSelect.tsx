import { useBoundStore } from "../../../store/store";

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
