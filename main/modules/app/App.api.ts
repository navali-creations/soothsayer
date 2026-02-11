import { ipcRenderer } from "electron";

import { AppChannel } from "./App.channels";

const AppAPI = {
  restart: () => ipcRenderer.invoke(AppChannel.Restart),
  quit: () => ipcRenderer.invoke(AppChannel.Quit),
  minimizeToTray: () => ipcRenderer.invoke(AppChannel.MinimizeToTray),
};

export { AppAPI };
