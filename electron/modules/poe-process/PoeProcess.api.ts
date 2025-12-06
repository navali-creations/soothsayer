import { ipcRenderer } from "electron";
import { PoeProcessChannel } from "./PoeProcess.channels";

const PoeProcessAPI = {
  getState: () => ipcRenderer.invoke(PoeProcessChannel.IsRunning),
  onStart: (callback: (state: any) => void) => {
    ipcRenderer.on(PoeProcessChannel.Start, (_event, state) => callback(state));
  },
  onStop: (callback: (state: any) => void) => {
    ipcRenderer.on(PoeProcessChannel.Stop, (_event, state) => callback(state));
  },
  onState: (callback: (state: any) => void) => {
    ipcRenderer.on(PoeProcessChannel.GetState, (_event, state) =>
      callback(state),
    );
  },
  onError: (callback: (error: any) => void) => {
    ipcRenderer.on(PoeProcessChannel.GetError, (_event, error) =>
      callback(error),
    );
  },
};

export { PoeProcessAPI };
