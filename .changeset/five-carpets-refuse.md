---
"soothsayer": patch
---

**Database separation:** Introduced 3-tier SQLite database naming to isolate data between environments:
- `soothsayer.local.db` — local Supabase (localhost/127.0.0.1)
- `soothsayer.db` — development with production Supabase credentials
- `soothsayer.prod.db` — packaged release builds

This prevents development data from polluting production installs and vice versa.

**Release notes:** GitHub Releases now use changeset-generated notes from `CHANGELOG.md` instead of auto-generated commit lists, eliminating dependabot noise.

**Changelog links:** Switched to `@changesets/changelog-github` for clickable commit hashes, PR links, and contributor mentions in release notes.