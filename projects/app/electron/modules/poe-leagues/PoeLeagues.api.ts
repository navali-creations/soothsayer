import { ipcRenderer } from "electron";

import { PoeLeaguesChannel } from "./PoeLeagues.channels";

const PoeLeaguesAPI = {
  fetchLeagues: (game: Extract<GameVersion, "poe1" | "poe2">) =>
    ipcRenderer.invoke(PoeLeaguesChannel.FetchLeagues, game),
  getSelected: () => ipcRenderer.invoke(PoeLeaguesChannel.GetSelectedLeague),
  setSelected: (leagueId: string) =>
    ipcRenderer.invoke(PoeLeaguesChannel.SelectLeague, leagueId),
};

export { PoeLeaguesAPI };
