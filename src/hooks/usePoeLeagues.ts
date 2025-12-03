import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { PoeLeague } from "../../types/poe-league";

export function usePoeLeagues() {
  const queryClient = useQueryClient();

  const leaguesQuery = useQuery({
    queryKey: ["poe-leagues"],
    queryFn: async (): Promise<PoeLeague[]> => {
      return window.electron.poeLeagues.fetchLeagues();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const selectedLeagueQuery = useQuery({
    queryKey: ["selected-league"],
    queryFn: async (): Promise<string> => {
      return window.electron.poeLeagues.getSelected();
    },
  });

  const setSelectedLeague = useMutation({
    mutationFn: async (leagueId: string) => {
      return window.electron.poeLeagues.setSelected(leagueId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["selected-league"] });
    },
  });

  return {
    leagues: leaguesQuery.data ?? [],
    isLoadingLeagues: leaguesQuery.isLoading,
    selectedLeague: selectedLeagueQuery.data ?? "Keepers",
    setSelectedLeague: setSelectedLeague.mutate,
    isSettingLeague: setSelectedLeague.isPending,
  };
}
