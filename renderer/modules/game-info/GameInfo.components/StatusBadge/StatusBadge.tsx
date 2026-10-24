import clsx from "clsx";
import { FiAlertCircle, FiCheckCircle, FiSlash } from "react-icons/fi";

import { useGameInfo } from "~/renderer/store";
import type { GameType } from "~/types/data-stores";

type StatusBadgeProps = {
  game: GameType;
};

const StatusBadge = ({ game }: StatusBadgeProps) => {
  const { isGameOnline, isProcessWatcherAvailable } = useGameInfo();
  const isOnline = isGameOnline(game);
  const isWatcherAvailable = isProcessWatcherAvailable();

  return (
    <div
      className={clsx(`badge badge-soft badge-xs gap-[5px]`, {
        "badge-success": isWatcherAvailable && isOnline,
        "badge-warning": !isWatcherAvailable,
      })}
    >
      {!isWatcherAvailable && (
        <>
          <FiAlertCircle />
          Unavailable
        </>
      )}
      {isWatcherAvailable && isOnline && (
        <>
          <FiCheckCircle />
          Running
        </>
      )}
      {isWatcherAvailable && !isOnline && (
        <>
          <FiSlash className="rotate-90" />
          Offline
        </>
      )}
    </div>
  );
};

export default StatusBadge;
