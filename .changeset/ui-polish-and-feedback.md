---
"soothsayer": patch
---

- **Feedback link updated:** The feedback link throughout the app now points to GitHub Discussions instead of Discord, so you can share feedback, ask questions, and report issues all in one place.

- **Clickable changelog releases:** Version badges in the changelog timeline now link directly to the corresponding GitHub release page. You can also click anywhere on a release card to open it — a colored border appears on hover to show it's interactive.

- **Improved changelog spacing:** Added breathing room between entries in the changelog for a cleaner, easier-to-read layout.

- **Changelog history cleanup:** Consolidated versions 0.3.1–0.3.5 into 0.3.6, since those were iterative CI/CD signing fixes without individual release tags.

- **Fixed release type labels:** Releases that include both "Minor Changes" and "Patch Changes" sections now correctly show as a minor release instead of being mislabeled as a patch.

- **Fixed images overflowing in release notes:** Images in the "What's New" dialog and markdown content no longer overflow their containers — they now scale down to fit properly.

- **Fixed horizontal scrollbar in "What's New":** The "What's New" dialog no longer shows an unnecessary horizontal scrollbar when content is slightly wider than expected.