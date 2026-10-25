import { FiTrash2 } from "react-icons/fi";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";

interface LeagueDeleteButtonProps {
  league: LeagueStorageUsage;
  deletingLeagueId: string | null;
  onDelete: (league: LeagueStorageUsage) => void;
}

export function LeagueDeleteButton({
  league,
  deletingLeagueId,
  onDelete,
}: LeagueDeleteButtonProps) {
  const isDeleting = deletingLeagueId === league.leagueId;
  const anyDeleting = deletingLeagueId != null;
  const tooltip = league.hasActiveSession
    ? "Cannot delete while session is active"
    : `Delete all data for ${league.leagueName}`;

  const handleDelete = () => {
    onDelete(league);
  };

  return (
    <Tooltip as="div" content={tooltip} describeChild>
      <button
        type="button"
        aria-label={tooltip}
        className="btn btn-ghost btn-xs btn-square text-error disabled:text-error/30"
        disabled={league.hasActiveSession || anyDeleting}
        onClick={handleDelete}
      >
        {isDeleting ? (
          <span className="loading loading-spinner loading-xs" />
        ) : (
          <FiTrash2 className="w-3.5 h-3.5" />
        )}
      </button>
    </Tooltip>
  );
}
