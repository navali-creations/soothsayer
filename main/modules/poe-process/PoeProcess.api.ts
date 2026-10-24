import { ipcRenderer } from "electron";

import { PoeProcessChannel } from "./PoeProcess.channels";
import type { PoeProcessSnapshot } from "./PoeProcess.dto";

const PoeProcessAPI = {
  getSnapshot: (): Promise<PoeProcessSnapshot> =>
    ipcRenderer.invoke(PoeProcessChannel.GetSnapshot),

  onSnapshot: (callback: (snapshot: PoeProcessSnapshot) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      snapshot: PoeProcessSnapshot,
    ) => callback(snapshot);
    ipcRenderer.on(PoeProcessChannel.SnapshotChanged, handler);

    return () => {
      ipcRenderer.removeListener(PoeProcessChannel.SnapshotChanged, handler);
    };
  },
};

export { PoeProcessAPI };
