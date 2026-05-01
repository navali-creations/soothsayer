import { ipcRenderer } from "electron";

import type { GameType } from "../../../types/data-stores";
import { PoeLeaguesChannel } from "./PoeLeagues.channels";

const PoeLeaguesAPI = {
  fetchLeagues: (game: GameType) =>
    ipcRenderer.invoke(PoeLeaguesChannel.FetchLeagues, game),
  getAllLeagues: (game: GameType) =>
    ipcRenderer.invoke(PoeLeaguesChannel.GetAllLeagues, game),
  getSelected: () => ipcRenderer.invoke(PoeLeaguesChannel.GetSelectedLeague),
  setSelected: (leagueId: string) =>
    ipcRenderer.invoke(PoeLeaguesChannel.SelectLeague, leagueId),
};

export { PoeLeaguesAPI };
