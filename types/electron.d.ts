import type { AnalyticsAPI } from "../main/modules/analytics/Analytics.api";
import type { AppAPI } from "../main/modules/app/App.api";
import type { AppSetupAPI } from "../main/modules/app-setup/AppSetup.api";
import type { CardDetailsAPI } from "../main/modules/card-details/CardDetails.api";
import type { CommunityUploadAPI } from "../main/modules/community-upload/CommunityUpload.api";
import type { CsvAPI } from "../main/modules/csv/Csv.api";
import type { CurrentSessionAPI } from "../main/modules/current-session/CurrentSession.api";
import type { DataStoreAPI } from "../main/modules/data-store/DataStore.api";
import type { DiagLogAPI } from "../main/modules/diag-log/DiagLog.api";
import type { DivinationCardsApi } from "../main/modules/divination-cards/DivinationCards.api";
import type { GggAuthAPI } from "../main/modules/ggg-auth/GggAuth.api";
import type { MainWindowAPI } from "../main/modules/main-window/MainWindow.api";
import type { OverlayAPI } from "../main/modules/overlay/Overlay.api";
import type { PoeLeaguesAPI } from "../main/modules/poe-leagues/PoeLeagues.api";
import type { PoeNinjaAPI } from "../main/modules/poe-ninja/PoeNinja.api";
import type { PoeProcessAPI } from "../main/modules/poe-process/PoeProcess.api";
import type { ProfitForecastAPI } from "../main/modules/profit-forecast/ProfitForecast.api";
import type { RarityInsightsAPI } from "../main/modules/rarity-insights/RarityInsights.api";
import type { SessionsAPI } from "../main/modules/sessions/Sessions.api";
import type { SettingsStoreAPI } from "../main/modules/settings-store/SettingsStore.api";
import type { SnapshotAPI } from "../main/modules/snapshots/Snapshot.api";
import type { StorageAPI } from "../main/modules/storage/Storage.api";
import type { UpdaterAPI } from "../main/modules/updater/Updater.api";

declare global {
  interface Window {
    electron: {
      selectFile: (options: any) => Promise<string | undefined>;
      communityUpload: typeof CommunityUploadAPI;
      gggAuth: typeof GggAuthAPI;
      csv: typeof CsvAPI;
      cardDetails: typeof CardDetailsAPI;
      session: typeof CurrentSessionAPI;
      sessions: typeof SessionsAPI;
      snapshots: typeof SnapshotAPI;
      mainWindow: typeof MainWindowAPI;
      app: typeof AppAPI;
      overlay: typeof OverlayAPI;
      appSetup: typeof AppSetupAPI;
      diagLog: typeof DiagLogAPI;
      poeProcess: typeof PoeProcessAPI;
      dataStore: typeof DataStoreAPI;
      poeNinja: typeof PoeNinjaAPI;
      poeLeagues: typeof PoeLeaguesAPI;
      settings: typeof SettingsStoreAPI;
      analytics: typeof AnalyticsAPI;
      divinationCards: typeof DivinationCardsApi;
      updater: typeof UpdaterAPI;
      rarityInsights: typeof RarityInsightsAPI;
      profitForecast: typeof ProfitForecastAPI;
      storage: typeof StorageAPI;
    };
  }
}
