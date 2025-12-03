import { usePoeLeagues } from "../../hooks";

function LeagueSelector() {
  const { leagues, selectedLeague, setSelectedLeague } = usePoeLeagues();

  return (
    <select
      value={selectedLeague}
      onChange={(e) => setSelectedLeague(e.target.value)}
    >
      {leagues.map((league) => (
        <option key={league.id} value={league.id}>
          {league.name}
        </option>
      ))}
    </select>
  );
}

export default LeagueSelector;
