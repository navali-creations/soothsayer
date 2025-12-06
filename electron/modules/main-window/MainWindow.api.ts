import { ipcRenderer } from "electron";
import { MainWindowChannel } from "./MainWindow.channels";

const MainWindowAPI = {
  minimize: () => ipcRenderer.invoke(MainWindowChannel.Minimize),
  maximize: () => ipcRenderer.invoke(MainWindowChannel.Maximize),
  unmaximize: () => ipcRenderer.invoke(MainWindowChannel.Unmaximize),
  isMaximized: () => ipcRenderer.invoke(MainWindowChannel.IsMaximized),
  close: () => ipcRenderer.invoke(MainWindowChannel.Close),
};

export { MainWindowAPI };
