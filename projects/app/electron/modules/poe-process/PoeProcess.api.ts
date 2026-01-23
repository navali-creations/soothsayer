import { ipcRenderer } from "electron";

import { PoeProcessChannel } from "./PoeProcess.channels";

const PoeProcessAPI = {
  getState: () => ipcRenderer.invoke(PoeProcessChannel.IsRunning),

  onStart: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on(PoeProcessChannel.Start, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(PoeProcessChannel.Start, handler);
    };
  },

  onStop: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on(PoeProcessChannel.Stop, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(PoeProcessChannel.Stop, handler);
    };
  },

  onState: (callback: (state: any) => void) => {
    const handler = (_event: any, state: any) => callback(state);
    ipcRenderer.on(PoeProcessChannel.GetState, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(PoeProcessChannel.GetState, handler);
    };
  },

  onError: (callback: (error: any) => void) => {
    const handler = (_event: any, error: any) => callback(error);
    ipcRenderer.on(PoeProcessChannel.GetError, handler);

    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(PoeProcessChannel.GetError, handler);
    };
  },
};

export { PoeProcessAPI };
