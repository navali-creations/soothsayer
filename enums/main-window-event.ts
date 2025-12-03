export enum MainWindowEvent {
  OnAppStart = "on-app-restart",
  OnClose = "close",
  HandleWindowClose = "handle-main-window-close",
  HandleWindowMaximize = "handle-main-window-maximize",
  HandleWindowMinimize = "handle-main-window-minimize",
  HandleWindowUnmaximize = "handle-main-window-unmaximize",
  IsWindowMaximized = "is-window-maximized",
  IsPoeRunning = "is-poe-running",
  GetCollection = "get-collection",
  ReadyToShow = "ready-to-show",
}
