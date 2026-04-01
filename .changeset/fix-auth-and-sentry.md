---
"soothsayer": patch
---

**Fixed:** Resolved an issue where some users were unable to connect to our servers on app startup, causing the league selection to only show "Standard" instead of the full list of available leagues. This was caused by a server-side security key rotation that invalidated previously stored sessions. The app now properly recovers from expired sessions automatically.

**Improved:** Added comprehensive crash and error reporting to key parts of the app — including server connections, league fetching, and session management. Previously, many errors were silently handled without being reported, making it difficult to diagnose issues. This will help us identify and fix problems much faster going forward.