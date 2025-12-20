import clsx from "clsx";
import {
  type GameVersion,
  SettingsKey,
} from "../../../../../../electron/modules/settings-store/SettingsStore.schemas";
import { Button } from "../../../../../components";
import { LeagueSelect, StatusBadge } from "../../../../../modules/game-info";
import { useBoundStore } from "../../../../../store/store";

type GameSelectorTabProps = {
  game: Extract<GameVersion, "poe1" | "poe2">;
};

const GameSelectorTab = ({ game }: GameSelectorTabProps) => {
  const {
    settings: { getActiveGame, setSetting },
  } = useBoundStore();
  const isActive = game === getActiveGame();
  const label = game === "poe1" ? "Path of Exile 1" : "Path of Exile 2";

  const handleGameSelect = () => {
    setSetting(SettingsKey.ActiveGame, game);
  };

  return (
    <div
      role="tab"
      className={clsx(
        { "tab-active": isActive },
        "tab tab-border-half gap-2 relative",
      )}
    >
      <Button onClick={handleGameSelect} variant="ghost" className="p-0">
        <span className="font-fontin">{label}</span>
        <StatusBadge game={game} />
      </Button>
      <LeagueSelect game={game} />
    </div>
  );
};

export default GameSelectorTab;
