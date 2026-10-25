import { BackButton, Flex } from "~/renderer/components";
import { useCardDetails } from "~/renderer/store";

const HeaderActions = () => {
  const { selectedLeague, setSelectedLeague, getAvailableLeagues } =
    useCardDetails();

  const availableLeagues = getAvailableLeagues();
  const leagueOptions =
    selectedLeague !== "all" && !availableLeagues.includes(selectedLeague)
      ? [selectedLeague, ...availableLeagues]
      : availableLeagues;

  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
  };

  return (
    <Flex className="items-center gap-2 flex-nowrap">
      {/* Back button */}
      <BackButton fallback="/cards" />

      {/* League selector */}
      <select
        aria-label="Card details league"
        className="select select-sm select-bordered w-40"
        value={selectedLeague}
        onChange={(e) => handleLeagueChange(e.target.value)}
      >
        <option value="all">All Leagues</option>
        {leagueOptions.map((league) => (
          <option key={league} value={league}>
            {league}
          </option>
        ))}
      </select>
    </Flex>
  );
};

export default HeaderActions;
