import { ipcRenderer } from "electron";

import { DataStoreChannel } from "./DataStore.channels";

const DataStoreAPI = {
  getAllTime: (game: "poe1" | "poe2") =>
    ipcRenderer.invoke(DataStoreChannel.GetAllTimeStats, game),
  getLeague: (game: "poe1" | "poe2", league: string) =>
    ipcRenderer.invoke(DataStoreChannel.GetLeagueStats, game, league),
  getLeagues: (game: "poe1" | "poe2") =>
    ipcRenderer.invoke(DataStoreChannel.GetLeagues, game),
  getGlobal: () => ipcRenderer.invoke(DataStoreChannel.GetGlobal),
};

export { DataStoreAPI };
