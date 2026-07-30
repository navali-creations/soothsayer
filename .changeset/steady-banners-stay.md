---
"soothsayer": patch
---

**Fixed:** The Community Drop Rates contribution banner no longer flashes after being dismissed or comes back after app update.

The app waits for your saved banner preference before showing the prompt, so an already-dismissed banner does not briefly return after an update or reload.

- **Reliable contribution:** the banner closes only after existing drop data has been queued successfully.
- **Atomic preferences:** successful backfills and the saved dismissal now commit together, while partial failures keep the prompt available for retry.
