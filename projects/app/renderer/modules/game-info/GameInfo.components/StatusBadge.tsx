import clsx from "clsx";
import type { GameVersion } from "electron/modules";
import { FiCheckCircle, FiSlash } from "react-icons/fi";
import { useBoundStore } from "~/renderer/store";

type StatusBadgeProps = {
  game: Extract<GameVersion, "poe1" | "poe2">;
};

const StatusBadge = ({ game }: StatusBadgeProps) => {
  const {
    gameInfo: { isGameOnline },
  } = useBoundStore();
  const isOnline = isGameOnline(game);

  return (
    <div
      className={clsx(`badge badge-soft badge-xs gap-[5px]`, {
        "badge-success": isOnline,
      })}
    >
      {isOnline ? (
        <>
          <FiCheckCircle />
          Online
        </>
      ) : (
        <>
          <FiSlash className="rotate-90" />
          Offline
        </>
      )}
    </div>
  );
};

export default StatusBadge;
