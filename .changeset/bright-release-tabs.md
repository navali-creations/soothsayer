---
"soothsayer": patch
---

**Changed:** What's New dialog now focuses on the main release first, with patch releases available beside it.

When Soothsayer opens after an update, the modal now starts on the newest major or minor release you missed, then lets you switch to the related patch releases from the same update range.

- **Release versions:** compact version pills show the available releases and use the same major, minor, and patch colors as the changelog.
- **Opening later:** opening What's New manually still shows the latest patch release for the current minor version.
- **Update acknowledgement:** update releases are marked as seen only after the modal loads and is closed, so a temporary release-fetch failure can be retried on the next launch.
- **Modal backdrop:** the app sidebar now blurs consistently behind modal windows.
