import { FiDownload } from "react-icons/fi";

import { Button, Flex } from "../../../components";
import { useBoundStore } from "../../../store/store";

interface StatisticsActionsProps {
  availableLeagues: string[];
  onExport: () => void;
}

export const StatisticsActions = ({
  availableLeagues,
  onExport,
}: StatisticsActionsProps) => {
  const {
    statistics: { statScope, selectedLeague, setStatScope, setSelectedLeague },
  } = useBoundStore();

  return (
    <Flex className="gap-2 items-center">
      {/* Stat Scope Toggle */}
      <div role="tablist" className="tabs tabs-border">
        <button
          role="tab"
          className={`tab ${statScope === "all-time" ? "tab-active" : ""}`}
          onClick={() => setStatScope("all-time")}
        >
          All-Time
        </button>
        <button
          role="tab"
          className={`tab ${statScope === "league" ? "tab-active" : ""}`}
          onClick={() => setStatScope("league")}
        >
          League
        </button>
      </div>

      {/* League Selector - only show when League scope is selected */}
      {statScope === "league" && availableLeagues.length > 0 && (
        <select
          className="select select-bordered"
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(e.target.value)}
        >
          {availableLeagues.map((league) => (
            <option key={league} value={league}>
              {league}
            </option>
          ))}
        </select>
      )}
      <Button variant="primary" outline onClick={onExport}>
        <FiDownload /> Export CSV
      </Button>
    </Flex>
  );
};
