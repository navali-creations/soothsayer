# soothsayer

## 0.6.0

### Minor Changes

- [`cecd239`](https://github.com/navali-creations/soothsayer/commit/cecd239d11353214258832bcbbfc1dd8fe9476ff) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Overlay lock/unlock:** You can now toggle the overlay between a locked (click-through) mode for gameplay and an unlocked mode where you can drag and resize it freely. A pulsing glow border lets you know when the overlay is unlocked. The overlay always starts locked when you open it.

  - **Smart overlay layout:** The overlay now detects which side of your screen it's on and automatically flips its layout to match — so it always looks and feels right whether you place it on the left or right side.

  - **Overlay font size controls:** Two new sliders in Settings let you adjust the overlay's content and toolbar text sizes independently (from 50% to 200%). Changes show up immediately on the overlay — no restart needed.

  - **Overlay size controls:** New width and height sliders in Settings let you resize the overlay to fit your preference. The overlay updates in real time as you adjust the sliders, even while it's open during a game.

  - **Restore overlay defaults:** A single button in the new Overlay section of Settings resets everything — position, size, and font sizes — back to the defaults.

  - **Overlay Settings section:** All overlay controls are now grouped in a dedicated card on the Settings page, keeping everything easy to find in one place.

  - **Overlay no longer spawns off-screen:** On smaller displays (like 1366×768 laptops), the overlay could appear outside the visible area. It now defaults to the top-left corner of your screen with a small margin.

  - **Window position remembered:** The app now remembers where you left the main window and restores it on the next launch. If you've since disconnected a monitor, it falls back to a centered default instead of opening off-screen.

### Patch Changes

- [`cecd239`](https://github.com/navali-creations/soothsayer/commit/cecd239d11353214258832bcbbfc1dd8fe9476ff) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Alt+F4 now respects your exit preference:** Previously, pressing Alt+F4 always hid the app to the tray regardless of your chosen exit behavior in Settings. Now it correctly follows your preference — quitting the app if set to "exit", or minimizing to tray if set to "minimize".

  - **Tray icon restores the window again:** Clicking the tray icon or choosing "Show Soothsayer" from the tray menu now properly brings the window back. Previously, the app could get stuck hidden in the tray with no way to reopen it.

  - **Opening Soothsayer twice focuses the existing window:** If the app is already running and you try to launch it again, the existing window now correctly comes to the front — even if it was minimized.

## 0.5.1

### Patch Changes

- [`61a3e93`](https://github.com/navali-creations/soothsayer/commit/61a3e93b3d13984dccd93514476672155c3cd53c) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Feedback link updated:** The feedback link throughout the app now points to GitHub Discussions instead of Discord, so you can share feedback, ask questions, and report issues all in one place.

  - **Clickable changelog releases:** Version badges in the changelog timeline now link directly to the corresponding GitHub release page. You can also click anywhere on a release card to open it — a colored border appears on hover to show it's interactive.

  - **Improved changelog spacing:** Added breathing room between entries in the changelog for a cleaner, easier-to-read layout.

  - **Changelog history cleanup:** Consolidated versions 0.3.1–0.3.5 into 0.3.6, since those were iterative CI/CD signing fixes without individual release tags.

  - **Fixed release type labels:** Releases that include both "Minor Changes" and "Patch Changes" sections now correctly show as a minor release instead of being mislabeled as a patch.

  - **Fixed images overflowing in release notes:** Images in the "What's New" dialog and markdown content no longer overflow their containers — they now scale down to fit properly.

  - **Fixed horizontal scrollbar in "What's New":** The "What's New" dialog no longer shows an unnecessary horizontal scrollbar when content is slightly wider than expected.

- [`2ce89ee`](https://github.com/navali-creations/soothsayer/commit/2ce89ee3df93455ba2c3506fe4e2996ca73fc8ea) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **"What's New" shows automatically after an update:** When you launch the app after installing an update, the "What's New" dialog will automatically pop up after a few seconds so you never miss what changed. It only appears once per update.

  - **Styled commit and contributor links in "What's New":** Commit references and contributor mentions in release notes now appear as neat, styled badges instead of plain links, making them easier to spot at a glance.

## 0.5.0

### Minor Changes

- [`d0229f3`](https://github.com/navali-creations/soothsayer/commit/d0229f3553e34a26836ef8d302c644493342d28f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Prohibited Library rarity source:** You can now use the Prohibited Library (community-sourced stacked deck weight data) as a rarity source. Select it from the rarity source dropdown in Settings — it's no longer grayed out.

  - **Weight-based card rarities:** Card rarities are derived from empirical drop-weight data collected by the Path of Exile Science & Data community, offering an alternative to price-based (poe.ninja) classification.

  - **Rarity Model integration:** A new "Prohibited Library" column appears on the Rarity Model comparison page, letting you compare weight-based rarities against poe.ninja prices and your loot filters side-by-side. Clickable rarity badges in the column header let you sort by specific tiers.

  - **Boss-exclusive card indicators:** Cards that are boss-exclusive drops (and therefore cannot drop from Stacked Decks) are now marked with a skull-crown icon in the Rarity Model table, so you can identify them at a glance.

  - **Prohibited Library status block:** When the Prohibited Library is selected as your rarity source, a new status panel in Settings shows the loaded league, card count, app version, and last-loaded timestamp. A reload button lets you re-parse the bundled data on demand.

  - **Snapshot rarity routing:** Creating or reusing a pricing snapshot now respects your chosen rarity source — if Prohibited Library is active, card rarities are derived from weight data instead of poe.ninja prices.

### Patch Changes

- [`e0f96f2`](https://github.com/navali-creations/soothsayer/commit/e0f96f29ea564f5cab8258847e77cda714b95487) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  Improved backend performance and reduced database size through automated cleanup of old request logs. This is a behind-the-scenes improvement that keeps the app running smoothly without any visible changes.

- [`f0f2031`](https://github.com/navali-creations/soothsayer/commit/f0f203165d22d839afab23cfb2399cc8102ab304) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Fixed inactive leagues showing in selector:** Ended leagues (e.g. Phrecia 2.0) no longer appear in the league selector.

  - **Fixed rarity filter ignoring rarity source:** The rarity filter and sort on the Cards page now correctly reflect whichever rarity source you've selected, instead of always using poe.ninja values.

  - **Fixed card animations when switching rarity source:** All cards now animate consistently when you change the rarity source, instead of some staying static.

  - **Boss card toggle on Cards page:** A new "Include boss cards" checkbox lets you show or hide boss-exclusive cards. They are hidden by default, matching the Rarity Model page behavior.

  - **Boss-exclusive card indicator:** Cards that only drop from bosses now display a skull-crown badge on the card itself with a tooltip.

  - **Rarity-colored card glow:** Cards on the Cards page now glow in their rarity color (white, blue, or cyan) instead of a plain white glow.

  - **Scroll to top on filter and page change:** Changing any filter or clicking a pagination button now scrolls the card grid back to the top.

- [`167448e`](https://github.com/navali-creations/soothsayer/commit/167448e015a341509bd9c62b2d31511fdce0bca1) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  This release fixes the `poe.ninja` column on the Rarity Model comparison page where it showed values from the most recently used filter instead of actual poe.ninja price-based rarities

- [`93ca5c6`](https://github.com/navali-creations/soothsayer/commit/93ca5c67d4ebe31d8fd5d7a4a9fa5b474b3888c2) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  Improved local development reliability by automatically restarting the Kong API gateway after the edge runtime restarts during setup. This prevents stale DNS routing issues that could cause edge function timeouts when developing locally.

- [`d25563e`](https://github.com/navali-creations/soothsayer/commit/d25563e1e6e652b6838ede22181af9b9cbf72440) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Overlay now respects your price source setting:** The in-game overlay previously always used exchange prices regardless of your selection. It now correctly shows stash or exchange prices based on your chosen price source.

  - **Live price source switching:** Changing your price source mid-session now immediately updates the overlay — no need to restart your session.

  - **More accurate card rarities:** Cards that only have stash pricing (no exchange data) are now marked as "Unknown" rarity instead of receiving a potentially misleading rarity based on unreliable stash prices.

  - **Unknown rarity indicator:** Cards with low-confidence pricing now show a warning icon in the overlay so you can tell at a glance which prices may be unreliable.

  - **Fixed rarity 0 being treated as common:** A bug caused cards intentionally classified as "Unknown" (rarity 0) to silently appear as "Common" (rarity 4). These cards now display correctly.

  - **PoE2 default price source:** New installations now default to exchange pricing for PoE2 (previously defaulted to stash). Existing users are not affected.

- [`8b6fc5d`](https://github.com/navali-creations/soothsayer/commit/8b6fc5d0100e5529f2ba837799426331c3d522ed) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  The pricing snapshot info shown during an active session now always matches the data actually used to price your cards

- [`d0229f3`](https://github.com/navali-creations/soothsayer/commit/d0229f3553e34a26836ef8d302c644493342d28f) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Custom rarity source dropdown:** The native select element for picking your rarity source (on the Cards and Current Session pages) has been replaced with a polished popover dropdown featuring grouped options, rich labels with hover hints, checkmarks, and outdated-filter warnings.

  - **Filter column rarity sorting:** Filter columns on the Rarity Model comparison page now have clickable R1–R4 rarity chips in their headers, letting you sort by a specific tier — just like the poe.ninja and Prohibited Library columns.

  - **Boss card toggle:** Boss-exclusive cards are now hidden from the Rarity Model table by default. A new "Include boss cards" checkbox in the toolbar lets you bring them back, at which point a skull-crown indicator column appears so you can identify them at a glance.

  - **"Show differences only" always visible:** The diff toggle on the Rarity Model toolbar is now always rendered (disabled when no filters are parsed) instead of appearing and disappearing, making the UI more predictable.

## 0.4.0

### Minor Changes

- [`c0fe2a1`](https://github.com/navali-creations/soothsayer/commit/c0fe2a1136ba330610ccee1ac182cd8a48b63654) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Refresh poe.ninja prices:** A new "Refresh poe.ninja" button on the Rarity Model page lets you manually fetch the latest card pricing data. After refreshing, the button shows a cooldown timer so you know exactly when the next refresh becomes available. Each league tracks its cooldown independently — switching leagues lets you refresh right away.

  - **Onboarding guides:** New interactive help beacons have been added across the app to explain key features. Look for the pulsing icons next to the poe.ninja column, the refresh button, and the scan/filter controls on the Rarity Model page, as well as the rarity source dropdown on the Current Session page.

  - **"Show differences only" toggle:** You can now filter the Rarity Model table to show only cards where your filter's rarity assignment differs from poe.ninja, making it easier to spot mismatches at a glance.

  - **Improved changelog rendering:** Release notes and changelogs now display with proper formatting — bold text, links, images, and code snippets all render correctly instead of showing raw Markdown.

## 0.3.7

### Patch Changes

- [`af025c6`](https://github.com/navali-creations/soothsayer/commit/af025c6f5baa3c279fa117c0a518bab8784af04b) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  As of this release, the CI/CD pipeline properly includes code signing of the app

## 0.3.6

### Patch Changes

- [`e1f7089`](https://github.com/navali-creations/soothsayer/commit/e1f70899b5f4a8eddcfea2c8fab51282d278e302) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  Iterative CI/CD fixes for Windows code signing (consolidates versions 0.3.1–0.3.5).

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
