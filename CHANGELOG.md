# soothsayer

## 0.3.7

### Patch Changes

- [`af025c6`](https://github.com/navali-creations/soothsayer/commit/af025c6f5baa3c279fa117c0a518bab8784af04b) Thanks [@sbsrnt](https://github.com/sbsrnt)! - Attempt at code signing files other than installer

## 0.3.6

### Patch Changes

- [`e1f7089`](https://github.com/navali-creations/soothsayer/commit/e1f70899b5f4a8eddcfea2c8fab51282d278e302) Thanks [@sbsrnt](https://github.com/sbsrnt)! - 6 time the charm?

## 0.3.5

### Patch Changes

- [`055d2b0`](https://github.com/navali-creations/soothsayer/commit/055d2b08f6106bd2202470bbdd542fb70b9010ee) Thanks [@sbsrnt](https://github.com/sbsrnt)! - 5 times the charm as they say.

## 0.3.4

### Patch Changes

- [`c5097c9`](https://github.com/navali-creations/soothsayer/commit/c5097c9ad354cd533530e109843db5ca68ceb285) Thanks [@sbsrnt](https://github.com/sbsrnt)! - Ok this is the one.

## 0.3.3

### Patch Changes

- [`9e7cea5`](https://github.com/navali-creations/soothsayer/commit/9e7cea5d78b35237d554cfc5dc058c1d7cfedcc1) Thanks [@sbsrnt](https://github.com/sbsrnt)! - This is the one.

## 0.3.2

### Patch Changes

- [`e67a0a2`](https://github.com/navali-creations/soothsayer/commit/e67a0a250b78261cc371e3fdff80cb82c519459d) Thanks [@sbsrnt](https://github.com/sbsrnt)! - Next signing attempt.

## 0.3.1

### Patch Changes

- [`54b3f6b`](https://github.com/navali-creations/soothsayer/commit/54b3f6b51d7ff75a1619fe58bd9977c6a44d7f2f) Thanks [@sbsrnt](https://github.com/sbsrnt)! - This version edits publish workflow to include app signing. (surely this will work)

## 0.3.0

### Minor Changes

- [`f3c33ee`](https://github.com/navali-creations/soothsayer/commit/f3c33ee25ab2789bca502a91847acf27de51350f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Loot filter support:** Soothsayer can now read your Path of Exile loot filters and use their tier assignments to set card rarities. Both local filters (from your PoE folder) and online filters (e.g. NeverSink) are automatically detected and available to select.

  - **Rarity source picker:** A new dropdown on the Cards page and Current Session lets you choose how card rarities are determined — either price-based via poe.ninja (the default) or driven by one of your installed loot filters.

  - **Rarity Model:** A new "Rarity Model" page lets you compare how different filters classify each divination card side-by-side. You can select multiple filters, search by card name, and even override individual card rarities.

  - **Price confidence indicators:** Card prices from poe.ninja now include a confidence level (high, medium, or low) so you can tell at a glance how reliable a price estimate is. This information flows through from the backend all the way to the UI.

  - **"Unknown" rarity tier:** Cards that haven't been classified yet (e.g. missing from a filter or not yet priced) now show as "unknown" instead of defaulting to "common," giving you a clearer picture of your collection.

  - **Overlay improvements:** The overlay drop list now uses the same shared rarity styles as the rest of the app and correctly reflects filter-based rarities when a filter is active.

  - **Backend improvements:** Snapshot creation now computes and stores price confidence from poe.ninja data. The card prices table has been updated accordingly, replacing the unused `stack_size` column with a `confidence` column.

### Patch Changes

- [`3d13ace`](https://github.com/navali-creations/soothsayer/commit/3d13ace60f953bd0fd2b0d160a9fd428e3fd138b) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - Add debug logger for better development experience

## 0.2.1

### Patch Changes

- [`168e98c`](https://github.com/navali-creations/soothsayer/commit/168e98c20bd02d9d4d5ebcea90ed0a543ff890ef) Thanks [@sbsrnt](https://github.com/sbsrnt)!
  - Fixed a startup crash that could occur when upgrading from a previous version. The app now starts reliably whether you're installing fresh or upgrading from an older release. Additional tests have been added to catch these issues before release, improving overall reliability.

## 0.2.0

### Minor Changes

- [`28b02f7`](https://github.com/navali-creations/soothsayer/commit/28b02f79d75168236c7a94246a4c15a07173f20a) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Audio settings:** You can now enable/disable drop sounds, adjust volume, and assign custom `.mp3` sounds for each rarity tier directly from Settings.

  - **Custom sounds:** Load your own sounds from your PoE filter sounds folder with a single click, preview them, and assign them to rarity tiers.

  - **Overlay audio:** The overlay now respects your audio settings — custom sounds play during sessions, with automatic fallback to defaults if a file is missing.

  - **Settings UI polish:** Consistent sizing and styling across all settings cards, buttons, and controls.

  - **View Source link:** A new "View Source" menu item links directly to the GitHub repository.

  - **Open source:** Soothsayer is now fully open source under the AGPL-3.0 license.

  - **README refresh:** Updated project description and added a download badge linking to the latest release.

## 0.1.5

### Patch Changes

- [`ae4e71f`](https://github.com/navali-creations/soothsayer/commit/ae4e71f62ecb25fcf008571ee0b4aec93d2bb36a) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **New title bar menu:** The settings icon in the title bar has been replaced with a dropdown menu. Settings, along with other new items, can now be found there.

  - **"What's New" dialog:** You can now see the latest release highlights at a glance — just open the new dropdown menu and click "What's New."

  - **Changelog page:** A full release history is now available right inside the app. Open the dropdown menu and click "Changelog" to browse past updates in a clean timeline view.

  - **Feedback link:** Quickly jump to our Discord to share feedback — also available in the new dropdown menu.

  - **Fixed divination cards not showing up:** Cards were not appearing on the Cards page in packaged builds due to an incorrect file path. They should now load correctly on first launch.

## 0.1.4

### Patch Changes

- [`f8b14d8`](https://github.com/navali-creations/soothsayer/commit/f8b14d8a80f42da47d9f408403118fc525cdb039) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Smoother updates:** Updates now install in the background without intrusive pop-up dialogs. When a new version is ready, a small green icon appears in the title bar so you can update at your convenience.

  - **Linux update notifications:** Linux users will now see a notification icon when a new version is available. Clicking it opens the GitHub Releases page where you can download the latest package.

## 0.1.3

### Patch Changes

- [`e4c6eaf`](https://github.com/navali-creations/soothsayer/commit/e4c6eaf37d5b4055b35058cd8f6be8d8656a4781) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Fixed cards not tracking on first launch**: Divination cards are now properly detected right away, even when you open the app for the first time
  - **Fixed app freezing after database reset**: The app now correctly restarts after resetting your data instead of getting stuck
  - **Added app controls**: You can now restart, quit, or minimize the app to tray directly from the interface
  - **Internal fixes**: Resolved a development environment issue with edge functions failing to start

## 0.1.2

### Patch Changes

- [`192ee4d`](https://github.com/navali-creations/soothsayer/commit/192ee4d7063eeb71b94bc70ffe589451861b8759) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Database separation:** Introduced 3-tier SQLite database naming to isolate data between environments:
    - `soothsayer.local.db` — local Supabase (localhost/127.0.0.1)
    - `soothsayer.db` — development with production Supabase credentials
    - `soothsayer.prod.db` — packaged release builds

  This prevents development data from polluting production installs and vice versa.

  - **Release notes:** GitHub Releases now use changeset-generated notes from `CHANGELOG.md` instead of auto-generated commit lists, eliminating dependabot noise.

  - **Changelog links:** Switched to `@changesets/changelog-github` for clickable commit hashes, PR links, and contributor mentions in release notes.

## 0.1.1

### Patch Changes

- 120df16: Add executable name for linux

## 0.1.0

### Minor Changes

- a63a54c: Pre-release version.

### Patch Changes

- d99f213: Initial release.
