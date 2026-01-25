enum MainWindowChannel {
  // Electron channels
  OnAppStart = "on-app-restart",
  OnClose = "on-close", // TODO: check if it's on-close or close
  ReadyToShow = "ready-to-show",

  // Custom channels
  Close = "main-window:close",
  Maximize = "main-window:maximize",
  Minimize = "main-window:minimize",
  Unmaximize = "main-window:unmaximize",
  IsMaximized = "main-window:is-maximized",
}

export { MainWindowChannel };
