---
"soothsayer": patch
---

**Fixed:** Resolved a critical issue where the app could not connect to our servers on Windows, causing league selection to default to "Standard" only. This affected all Windows installations since version 0.14.0 and has now been fully resolved — leagues will load correctly on first launch.

**Improved:** The Settings → Storage card now shows a clear loading spinner ("Analyzing storage…") while gathering disk usage information, instead of a brief flicker that provided no useful feedback.

**Improved:** Storage analysis no longer briefly freezes the app window. The file scanning process has been reworked to run smoothly in the background, keeping the interface responsive even with large data folders.