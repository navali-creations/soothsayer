# soothsayer

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
