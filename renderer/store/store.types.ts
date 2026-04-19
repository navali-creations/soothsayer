import type { AppMenuSlice } from "../modules/app-menu/AppMenu.slice/AppMenu.slice";
import type { BannersSlice } from "../modules/banners";
import type { CardDetailsSlice } from "../modules/card-details/CardDetails.slice/CardDetails.slice";
import type { CardsSlice } from "../modules/cards/Cards.slice/Cards.slice";
import type { ChangelogSlice } from "../modules/changelog/Changelog.slice/Changelog.slice";
import type { SessionSlice } from "../modules/current-session/CurrentSession.slice/CurrentSession.slice";
import type { GameInfoSlice } from "../modules/game-info/GameInfo.slice/GameInfo.slice";
import type { OnboardingSlice } from "../modules/onboarding/Onboarding.slice/Onboarding.slice";
import type { OverlaySlice } from "../modules/overlay/Overlay.slice/Overlay.slice";
import type { PoeNinjaSlice } from "../modules/poe-ninja/PoeNinja.slice/PoeNinja.slice";
import type { ProfitForecastSlice } from "../modules/profit-forecast/ProfitForecast.slice/ProfitForecast.slice";
import type { RarityInsightsSlice } from "../modules/rarity-insights/RarityInsights.slice/RarityInsights.slice";
import type { RarityInsightsComparisonSlice } from "../modules/rarity-insights/RarityInsightsComparison.slice/RarityInsightsComparison.slice";
import type { SessionDetailsSlice } from "../modules/session-details";
import type { SessionsSlice } from "../modules/sessions/Sessions.slice/Sessions.slice";
import type { CommunityUploadSlice } from "../modules/settings/CommunityUpload.slice/CommunityUpload.slice";
import type { SettingsSlice } from "../modules/settings/Settings.slice/Settings.slice";
import type { StorageSlice } from "../modules/settings/Storage.slice/Storage.slice";
import type { SetupSlice } from "../modules/setup/Setup.slice/Setup.slice";
import type { StatisticsSlice } from "../modules/statistics/Statistics.slice/Statistics.slice";
import type { UpdaterSlice } from "../modules/updater/Updater.slice/Updater.slice";

/**
 * The full bound store type representing the intersection of all slices.
 *
 * Slice creators must use this as the first type parameter of `StateCreator`
 * so that `set` and `get` are typed against the complete store. Without this,
 * `strictFunctionTypes` (part of `strict: true`) causes TS2345 errors because
 * function parameters are contravariant: a `set` that accepts `BoundStore`
 * cannot be assigned to a `set` that expects a narrower slice type.
 */
export interface RootActions {
  hydrate: () => Promise<void>;
  startListeners: () => () => void;
  reset: () => void;
}

export type BoundStore = BannersSlice &
  GameInfoSlice &
  SettingsSlice &
  StorageSlice &
  SetupSlice &
  SessionSlice &
  SessionsSlice &
  SessionDetailsSlice &
  CardDetailsSlice &
  CardsSlice &
  AppMenuSlice &
  ChangelogSlice &
  OverlaySlice &
  PoeNinjaSlice &
  StatisticsSlice &
  OnboardingSlice &
  UpdaterSlice &
  RarityInsightsSlice &
  ProfitForecastSlice &
  RarityInsightsComparisonSlice &
  CommunityUploadSlice &
  RootActions;
