import clsx from "clsx";

import { Button } from "~/renderer/components";
import { LeagueSelect, StatusBadge } from "~/renderer/modules/game-info";
import { useSettings } from "~/renderer/store";

type GameSelectorTabProps = {
  game: "poe1" | "poe2";
};

const GameSelectorTab = ({ game }: GameSelectorTabProps) => {
  const { getSelectedGame, updateSetting } = useSettings();
  const isActive = game === getSelectedGame();
  const label = game === "poe1" ? "Path of Exile 1" : "Path of Exile 2";

  const handleGameSelect = () => {
    updateSetting("selectedGame", game);
  };

  return (
    <div
      role="tab"
      className={clsx(
        { "tab-active": isActive },
        "tab tab-border-half gap-2 relative",
      )}
    >
      <Button
        onClick={handleGameSelect}
        variant="ghost"
        className="p-0 hover:bg-base-300"
      >
        <span className="font-fontin">{label}</span>
        <StatusBadge game={game} />
      </Button>
      <LeagueSelect game={game} />
    </div>
  );
};

export default GameSelectorTab;
