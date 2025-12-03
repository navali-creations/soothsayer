enum AppEvent {
  Activate = "activate",
  BeforeQuit = "before-quit",
  OpenUrl = "open-url",
  SecondInstance = "second-instance",
  WindowAllClosed = "window-all-closed",
  Restart = "restart",
}

enum AppExitAction {
  MinimizeToTray = "minimize-to-tray",
  Quit = "quit",
}

enum AppStartUpAction {
  OpenAtLogin = "open-at-login",
  OpenAtLoginMinimized = "open-at-login-minimized",
}

export { AppEvent, AppExitAction, AppStartUpAction };
