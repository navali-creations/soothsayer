import { ipcRenderer } from "electron";
import { PoeLeaguesChannel } from "./PoeLeagues.channels";

const PoeLeaguesAPI = {
  fetchLeagues: () => ipcRenderer.invoke(PoeLeaguesChannel.FetchLeagues),
  getSelected: () => ipcRenderer.invoke(PoeLeaguesChannel.GetSelectedLeague),
  setSelected: (leagueId: string) =>
    ipcRenderer.invoke(PoeLeaguesChannel.SelectLeague, leagueId),
};

export { PoeLeaguesAPI };
