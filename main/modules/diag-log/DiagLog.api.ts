import { ipcRenderer } from "electron";

import { DiagLogChannel } from "./DiagLog.channels";

const DiagLogAPI = {
  revealLogFile: (): Promise<{ success: boolean; path: string }> =>
    ipcRenderer.invoke(DiagLogChannel.RevealLogFile),
};

export { DiagLogAPI };
