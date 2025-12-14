/**
 * IPC Channels for Overlay module
 */
enum OverlayChannel {
  // Window control
  Show = "overlay:show",
  Hide = "overlay:hide",
  Toggle = "overlay:toggle",
  IsVisible = "overlay:is-visible",

  // Position & size
  SetPosition = "overlay:set-position",
  SetSize = "overlay:set-size",
  GetBounds = "overlay:get-bounds",

  // Opacity
  SetOpacity = "overlay:set-opacity",

  // Data
  GetSessionData = "overlay:get-session-data",
}

export { OverlayChannel };
