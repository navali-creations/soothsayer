import { useQuery } from "@tanstack/react-query";
import type { PoeNinjaPriceData } from "../../types/poe-ninja";

export function usePoeNinjaExchangePrices(
  league: string = "Keepers",
  enabled: boolean = true,
) {
  const query = useQuery({
    queryKey: ["poe-ninja-exchange-prices", league],
    queryFn: async (): Promise<PoeNinjaPriceData> => {
      return window.electron.poeNinja.fetchExchangePrices(league);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled, // Only fetch when enabled
  });

  const chaosToDivineRatio = query.data?.chaosToDivineRatio ?? 100;
  const cardPrices = query.data?.cardPrices ?? {};

  return {
    ...query,
    chaosToDivineRatio,
    cardPrices,
  };
}

export function usePoeNinjaStashPrices(
  league: string = "Keepers",
  enabled: boolean = true,
) {
  const query = useQuery({
    queryKey: ["poe-ninja-stash-prices", league],
    queryFn: async (): Promise<PoeNinjaPriceData> => {
      return window.electron.poeNinja.fetchStashPrices(league);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled, // Only fetch when enabled
  });

  const chaosToDivineRatio = query.data?.chaosToDivineRatio ?? 100;
  const cardPrices = query.data?.cardPrices ?? {};

  return {
    ...query,
    chaosToDivineRatio,
    cardPrices,
  };
}
