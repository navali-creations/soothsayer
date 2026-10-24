---
"soothsayer": minor
---

**Improved:** Game detection is now faster and more reliable through a dedicated native watcher.

- **Windows:** Path of Exile starts and stops are detected directly, with clearer feedback when detection itself is unavailable.
- **Linux:** Soothsayer can now detect running Path of Exile 1 and Path of Exile 2 clients.
- **Kakao Games:** Korean Path of Exile clients are detected, and both `Client.txt` and `KakaoClient.txt` logs can be selected during setup or from Settings.
- **Session reliability:** malformed card-drop log entries are ignored instead of being counted with an invalid identifier, and setup cannot finish after its selected game paths disappear.
