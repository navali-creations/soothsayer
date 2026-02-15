import type { AnalyticsAPI } from "../main/modules/analytics/Analytics.api";
import type { AppAPI } from "../main/modules/app/App.api";
import type { AppSetupAPI } from "../main/modules/app-setup/AppSetup.api";
import type { CurrentSessionAPI } from "../main/modules/current-session/CurrentSession.api";
import type { DataStoreAPI } from "../main/modules/data-store/DataStore.api";
import type { DivinationCardsApi } from "../main/modules/divination-cards/DivinationCards.api";
import type { FilterAPI } from "../main/modules/filters/Filter.api";
import type { MainWindowAPI } from "../main/modules/main-window/MainWindow.api";
import type { OverlayAPI } from "../main/modules/overlay/Overlay.api";
import type { PoeLeaguesAPI } from "../main/modules/poe-leagues/PoeLeagues.api";
import type { PoeNinjaAPI } from "../main/modules/poe-ninja/PoeNinja.api";
import type { PoeProcessAPI } from "../main/modules/poe-process/PoeProcess.api";
import type { SessionsAPI } from "../main/modules/sessions/Sessions.api";
import type { SettingsStoreAPI } from "../main/modules/settings-store/SettingsStore.api";
import type { SnapshotAPI } from "../main/modules/snapshots/Snapshot.api";
import type { UpdaterAPI } from "../main/modules/updater/Updater.api";

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
      mainWindow: typeof MainWindowAPI;
      app: typeof AppAPI;
      overlay: typeof OverlayAPI;
      appSetup: typeof AppSetupAPI;
      poeProcess: typeof PoeProcessAPI;
      dataStore: typeof DataStoreAPI;
      poeNinja: typeof PoeNinjaAPI;
      poeLeagues: typeof PoeLeaguesAPI;
      settings: typeof SettingsStoreAPI;
      analytics: typeof AnalyticsAPI;
      divinationCards: typeof DivinationCardsApi;
      updater: typeof UpdaterAPI;
      filters: typeof FilterAPI;
    };
  }
}
