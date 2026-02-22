---
"soothsayer": patch
---

Improved local development reliability by automatically restarting the Kong API gateway after the edge runtime restarts during setup. This prevents stale DNS routing issues that could cause edge function timeouts when developing locally.