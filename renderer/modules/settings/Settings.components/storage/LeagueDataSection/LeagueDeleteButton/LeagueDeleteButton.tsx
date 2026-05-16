import { FiTrash2 } from "react-icons/fi";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";

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

  const handleDelete = () => {
    onDelete(league);
  };

  return (
    <button
      type="button"
      className="btn btn-ghost btn-xs btn-square text-error disabled:text-error/30"
      disabled={league.hasActiveSession || anyDeleting}
      onClick={handleDelete}
      title={
        league.hasActiveSession
          ? "Cannot delete while session is active"
          : `Delete all data for ${league.leagueName}`
      }
    >
      {isDeleting ? (
        <span className="loading loading-spinner loading-xs" />
      ) : (
        <FiTrash2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
