import clsx from "clsx";
import { FiCheckCircle, FiSlash } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";
import type { GameType } from "~/types/data-stores";

type StatusBadgeProps = {
  game: GameType;
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
