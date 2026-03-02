---
"soothsayer": patch
---

- **Fixed a crash when closing the app during startup:** If you closed Soothsayer before it finished loading (for example, right after installing for the first time), the app could crash with an error. The app now handles this gracefully and shuts down cleanly.