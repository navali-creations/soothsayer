---
"soothsayer": patch
---

**Fixed:** Community uploads are much more reliable when sessions end, the app closes, or the computer goes to sleep.

- Uploads are now saved locally first, so a temporary network problem or app shutdown does not immediately lose community contribution data.
- Pending uploads are retried automatically when the app starts again or the computer wakes up.
- Ending a session and then closing the app no longer causes duplicate upload attempts for the same session.
- Community upload totals are now merged more safely on the server, so partial failures cannot leave the upload summary out of sync with the card data.
