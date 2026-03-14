---
"soothsayer": patch
---

**Fixed:** App window and overlay no longer appear off-screen after switching monitors.

- Previously, if you changed your monitor setup (e.g. disconnected a display, rearranged screens, or switched to a different monitor), the app or overlay could open in an invisible position based on the old layout. Now the app checks that its saved position is still within a visible display area on launch — if not, it resets to a default position on your current screen.