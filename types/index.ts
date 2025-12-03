import type {
  AppExitAction,
  AppStartUpAction,
  LocalStorageKey,
  MainWindowEvent,
  ReleaseChannel,
} from "enums";

type AppExitActions = (typeof AppExitAction)[keyof typeof AppExitAction];

type AppStartUpActions =
  (typeof AppStartUpAction)[keyof typeof AppStartUpAction];

type ReleaseChannels = (typeof ReleaseChannel)[keyof typeof ReleaseChannel];

type LocalStorageKeys =
  | LocalStorageKey.AppExitAction
  | LocalStorageKey.Poe1Path
  | LocalStorageKey.CollectionPath
  | LocalStorageKey.ReleaseChannel
  | LocalStorageKey.AppOpenAtLogin
  | LocalStorageKey.AppOpenAtLoginMinimized;

/**
 * Settings
 */
type FilePathsSectionItemType =
  | LocalStorageKey.Poe1Path
  | LocalStorageKey.CollectionPath;

type IpcRendererOnEvent<T> = (
  event: Electron.IpcRendererEvent,
  data: T,
) => void;

type Listeners = MainWindowEvent.IsPoeRunning;
// | AppUpdaterEvent.UPDATE_AVAILABLE;

export type UpdateAvailable = {
  update: boolean;
  version: string;
  newVersion: string;
};

type Settings = {
  [LocalStorageKey.Poe1Path]: string;
  [LocalStorageKey.CollectionPath]: string;
  [LocalStorageKey.ReleaseChannel]: ReleaseChannels;
  [LocalStorageKey.AppExitAction]: AppExitActions;
  [LocalStorageKey.AppOpenAtLogin]: boolean;
  [LocalStorageKey.AppOpenAtLoginMinimized]: boolean;
};

type AppControlsAPI = {
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  unmaximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
};

type PoeProcessAPI = {
  getState: () => Promise<{ isRunning: boolean }>;
  onStart: (
    callback: (state: { isRunning: boolean; processName: string }) => void,
  ) => void;
  onStop: (
    callback: (state: { isRunning: boolean; processName: string }) => void,
  ) => void;
  onState: (
    callback: (state: { isRunning: boolean; processName: string }) => void,
  ) => void;
  onError: (callback: (error: { error: string }) => void) => void;
};

export type {
  ReleaseChannels,
  LocalStorageKeys,
  FilePathsSectionItemType,
  AppExitActions,
  AppStartUpActions,
  AppControlsAPI,
  Settings,
  Listeners,
  IpcRendererOnEvent,
  PoeProcessAPI,
};
