/**
 * IPC Channels for Overlay module
 */
enum OverlayChannel {
  // Window control
  Show = "overlay:show",
  Hide = "overlay:hide",
  Toggle = "overlay:toggle",
  IsVisible = "overlay:is-visible",
  VisibilityChanged = "overlay:visibility-changed",

  // Position & size
  SetPosition = "overlay:set-position",
  SetSize = "overlay:set-size",
  GetBounds = "overlay:get-bounds",

  // Lock/unlock
  SetLocked = "overlay:set-locked",

  // Data
  GetSessionData = "overlay:get-session-data",

  // Settings sync
  SettingsChanged = "overlay:settings-changed",
}

export { OverlayChannel };
