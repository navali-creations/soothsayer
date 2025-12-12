import { ipcRenderer } from "electron";
import { AnalyticsChannel } from "./Analytics.channels";

const AnalyticsAPI = {
  getMostCommonCards: (game: string, league: string, limit = 10) =>
    ipcRenderer.invoke(
      AnalyticsChannel.GetMostCommonCards,
      game,
      league,
      limit,
    ),

  getHighestValueCards: (
    game: string,
    league: string,
    priceSource: "exchange" | "stash" = "exchange",
    limit = 10,
  ) =>
    ipcRenderer.invoke(
      AnalyticsChannel.GetHighestValueCards,
      game,
      league,
      priceSource,
      limit,
    ),

  getCardPriceHistory: (
    game: string,
    league: string,
    cardName: string,
    priceSource: "exchange" | "stash" = "exchange",
  ) =>
    ipcRenderer.invoke(
      AnalyticsChannel.GetCardPriceHistory,
      game,
      league,
      cardName,
      priceSource,
    ),

  getLeagueAnalytics: (game: string, league: string) =>
    ipcRenderer.invoke(AnalyticsChannel.GetLeagueAnalytics, game, league),

  compareSessions: (sessionId1: string, sessionId2: string) =>
    ipcRenderer.invoke(
      AnalyticsChannel.CompareSessions,
      sessionId1,
      sessionId2,
    ),

  getOccurrenceRatios: (game: string, league: string) =>
    ipcRenderer.invoke(AnalyticsChannel.GetOccurrenceRatios, game, league),
};

export { AnalyticsAPI };
