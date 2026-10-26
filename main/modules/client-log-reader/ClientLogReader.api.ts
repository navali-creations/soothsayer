import { ipcRenderer } from "electron";

import { ClientLogReaderChannel } from "./ClientLogReader.channels";
import type { HistoricalContextBackfillResult } from "./ClientLogReader.dto";

const ClientLogReaderAPI = {
  runHistoricalContextBackfill: (): Promise<HistoricalContextBackfillResult> =>
    ipcRenderer.invoke(ClientLogReaderChannel.RunHistoricalContextBackfill),
};

export { ClientLogReaderAPI };
