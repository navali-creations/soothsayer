import type { AnalyticsAPI } from "../electron/modules/analytics/Analytics.api";
import type { AppSetupAPI } from "../electron/modules/app-setup/AppSetup.api";
import type { CurrentSessionAPI } from "../electron/modules/current-session/CurrentSession.api";
import type { DataStoreAPI } from "../electron/modules/data-store/DataStore.api";
import type { MainWindowAPI } from "../electron/modules/main-window/MainWindow.api";
import type { OverlayAPI } from "../electron/modules/overlay/Overlay.api";
import type { PoeLeaguesAPI } from "../electron/modules/poe-leagues/PoeLeagues.api";
import type { PoeNinjaAPI } from "../electron/modules/poe-ninja/PoeNinja.api";
import type { PoeProcessAPI } from "../electron/modules/poe-process/PoeProcess.api";
import type { SessionsAPI } from "../electron/modules/sessions/Sessions.api";
import type { SettingsStoreAPI } from "../electron/modules/settings-store/SettingsStore.api";
import type { DivinationCardsApi } from "../electron/modules/divination-cards/DivinationCards.api";
import type { SnapshotAPI } from "../electron/modules/snapshots/Snapshot.api";

declare global {
  interface Window {
    electron: {
      selectFile: (options: any) => Promise<string | undefined>;
      csv: {
        export: () => Promise<any>;
      };
      session: typeof CurrentSessionAPI;
      sessions: typeof SessionsAPI;
      snapshots: typeof SnapshotAPI;
      app: typeof MainWindowAPI;
      overlay: typeof OverlayAPI;
      appSetup: typeof AppSetupAPI;
      poeProcess: typeof PoeProcessAPI;
      dataStore: typeof DataStoreAPI;
      poeNinja: typeof PoeNinjaAPI;
      poeLeagues: typeof PoeLeaguesAPI;
      settings: typeof SettingsStoreAPI;
      analytics: typeof AnalyticsAPI;
      divinationCards: typeof DivinationCardsApi;
    };
  }
}

export {};
