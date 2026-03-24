---
"soothsayer": patch
---

**Fixed:** App crashing on startup with "cannot find module tslib" after updating to 0.12.1.

- A required library was accidentally excluded from the packaged app, causing a crash on launch. It is now correctly included in the production build.