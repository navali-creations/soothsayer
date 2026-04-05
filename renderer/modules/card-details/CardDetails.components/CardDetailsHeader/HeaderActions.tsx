import { FiUser } from "react-icons/fi";
import { GiCardExchange } from "react-icons/gi";

import { BackButton, Flex } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useCardDetails, useSettings } from "~/renderer/store";

const HeaderActions = () => {
  const {
    selectedLeague,
    setSelectedLeague,
    activeTab,
    setActiveTab,
    getAvailableLeagues,
    personalAnalytics,
  } = useCardDetails();
  const { getActiveGameViewSelectedLeague } = useSettings();

  const availableLeagues = getAvailableLeagues();
  const globalLeague = getActiveGameViewSelectedLeague();
  const cardName = personalAnalytics?.cardName;

  const handleLeagueChange = (league: string) => {
    setSelectedLeague(league);
    if (cardName) {
      trackEvent("card-details:league-change", { cardName, league });
    }
  };

  const handleTabChange = (tab: "market" | "your-data") => {
    setActiveTab(tab);
    if (tab === "market" && cardName) {
      trackEvent("card-details:market-data-click", {
        cardName,
        league: globalLeague,
      });
    }
  };

  return (
    <Flex className="items-center gap-2 flex-nowrap">
      {/* Back button */}
      <BackButton fallback="/cards" />

      {/* League selector */}
      <select
        className="select select-sm select-bordered max-w-40"
        value={selectedLeague}
        onChange={(e) => handleLeagueChange(e.target.value)}
      >
        <option value="all">All Leagues</option>
        {availableLeagues.map((league) => (
          <option key={league} value={league}>
            {league}
          </option>
        ))}
      </select>

      {/* Tab buttons — row layout with icon + label */}
      <div role="tablist" className="tabs tabs-border flex-nowrap">
        <button
          role="tab"
          className={`tab tab-sm flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "market" ? "tab-active" : ""
          }`}
          style={{ flexFlow: "row" }}
          onClick={() => handleTabChange("market")}
        >
          <GiCardExchange className="w-3.5 h-3.5" />
          Market Data
        </button>
        <button
          role="tab"
          className={`tab tab-sm flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "your-data" ? "tab-active" : ""
          }`}
          style={{ flexFlow: "row" }}
          onClick={() => handleTabChange("your-data")}
        >
          <FiUser className="w-3.5 h-3.5" />
          Your Data
        </button>
      </div>
    </Flex>
  );
};

export default HeaderActions;
