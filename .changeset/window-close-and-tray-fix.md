---
"soothsayer": patch
---

- **Alt+F4 now respects your exit preference:** Previously, pressing Alt+F4 always hid the app to the tray regardless of your chosen exit behavior in Settings. Now it correctly follows your preference — quitting the app if set to "exit", or minimizing to tray if set to "minimize".

- **Tray icon restores the window again:** Clicking the tray icon or choosing "Show Soothsayer" from the tray menu now properly brings the window back. Previously, the app could get stuck hidden in the tray with no way to reopen it.

- **Opening Soothsayer twice focuses the existing window:** If the app is already running and you try to launch it again, the existing window now correctly comes to the front — even if it was minimized.