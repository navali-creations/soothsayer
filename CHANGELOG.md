# soothsayer

## 0.1.3

### Patch Changes

- [`e4c6eaf`](https://github.com/navali-creations/soothsayer/commit/e4c6eaf37d5b4055b35058cd8f6be8d8656a4781) Thanks [@sbsrnt](https://github.com/sbsrnt)! - Bug fixes and improvements:

  - **Fixed cards not tracking on first launch**: Divination cards are now properly detected right away, even when you open the app for the first time
  - **Fixed app freezing after database reset**: The app now correctly restarts after resetting your data instead of getting stuck
  - **Added app controls**: You can now restart, quit, or minimize the app to tray directly from the interface
  - **Internal fixes**: Resolved a development environment issue with edge functions failing to start

## 0.1.2

### Patch Changes

- [`192ee4d`](https://github.com/navali-creations/soothsayer/commit/192ee4d7063eeb71b94bc70ffe589451861b8759) Thanks [@sbsrnt](https://github.com/sbsrnt)! - **Database separation:** Introduced 3-tier SQLite database naming to isolate data between environments:

  - `soothsayer.local.db` — local Supabase (localhost/127.0.0.1)
  - `soothsayer.db` — development with production Supabase credentials
  - `soothsayer.prod.db` — packaged release builds

  This prevents development data from polluting production installs and vice versa.

  **Release notes:** GitHub Releases now use changeset-generated notes from `CHANGELOG.md` instead of auto-generated commit lists, eliminating dependabot noise.

  **Changelog links:** Switched to `@changesets/changelog-github` for clickable commit hashes, PR links, and contributor mentions in release notes.

## 0.1.1

### Patch Changes

- 120df16: Add executable name for linux

## 0.1.0

### Minor Changes

- a63a54c: Pre-release version.

### Patch Changes

- d99f213: Initial release.
