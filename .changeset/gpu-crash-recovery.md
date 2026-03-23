---
"soothsayer": patch
---

**Added:** Search bar on the Statistics page.

- You can now search and filter your cards directly on the Statistics page.

**Improved:** The app now recovers automatically from GPU process crashes instead of freezing or closing unexpectedly.

- Chromium's GPU process can occasionally crash due to driver issues or resource pressure. Previously this could leave the app in a broken state or cause it to close without warning.
- The app now detects GPU process crashes and automatically relaunches itself. Your session stats are already saved, so no data is lost — you simply pick up where you left off.