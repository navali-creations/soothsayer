import type { AnalyticsAPI } from "../electron/modules/analytics/Analytics.api";
import type { AppSetupAPI } from "../electron/modules/app-setup/AppSetup.api";
import type { CurrentSessionAPI } from "../electron/modules/current-session/CurrentSession.api";
import type { DataStoreAPI } from "../electron/modules/data-store/DataStore.api";
import type { DivinationCardsAPI } from "../electron/modules/divination-cards/DivinationCards.api";
import type { MainWindowAPI } from "../electron/modules/main-window/MainWindow.api";
import type { PoeLeaguesAPI } from "../electron/modules/poe-leagues/PoeLeagues.api";
import type { PoeNinjaAPI } from "../electron/modules/poe-ninja/PoeNinja.api";
import type { PoeProcessAPI } from "../electron/modules/poe-process/PoeProcess.api";
import type { SessionsAPI } from "../electron/modules/sessions/Sessions.api";
import type { SettingsStoreAPI } from "../electron/modules/settings-store/SettingsStore.api";

export type ElectronAPI = {
  app: typeof MainWindowAPI;
  appSetup: typeof AppSetupAPI;
  settings: typeof SettingsStoreAPI;
  session: typeof CurrentSessionAPI;
  sessions: typeof SessionsAPI;
  divinationCards: typeof DivinationCardsAPI;
  dataStore: typeof DataStoreAPI;
  poeNinja: typeof PoeNinjaAPI;
  poeLeagues: typeof PoeLeaguesAPI;
  poeProcess: typeof PoeProcessAPI;
  analytics: typeof AnalyticsAPI;
  selectFile: (options: any) => Promise<string | null>;
};

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
