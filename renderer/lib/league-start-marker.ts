export interface LeagueLike {
  id?: string;
  name?: string;
  startAt?: string | null;
}

export interface ActiveLeagueStartMarker {
  time: number;
  label: string;
}

interface ResolveActiveLeagueStartMarkerParams {
  leagues: LeagueLike[];
  activeLeague: string | null | undefined;
  enabled: boolean;
}

export function resolveActiveLeagueStartMarker({
  leagues,
  activeLeague,
  enabled,
}: ResolveActiveLeagueStartMarkerParams): ActiveLeagueStartMarker | null {
  if (!enabled || !activeLeague) return null;

  const activeLeagueLower = activeLeague.toLowerCase();
  const activeLeagueFromGameInfo = leagues.find(
    (league) =>
      league.id === activeLeague ||
      league.name?.toLowerCase() === activeLeagueLower,
  );
  const activeLeagueStartTime = activeLeagueFromGameInfo?.startAt
    ? new Date(activeLeagueFromGameInfo.startAt).getTime()
    : Number.NaN;

  if (!Number.isFinite(activeLeagueStartTime)) return null;

  return {
    time: activeLeagueStartTime,
    label: activeLeagueFromGameInfo?.name ?? activeLeague,
  };
}
