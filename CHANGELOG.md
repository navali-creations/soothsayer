# soothsayer

## 0.14.3

### Patch Changes

- [`f447114`](https://github.com/navali-creations/soothsayer/commit/f44711499ee40262dc6ad874c0d24558cb1e325e) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Resolved a critical issue where the app could not connect to our servers on Windows, causing league selection to default to "Standard" only. This affected all Windows installations since version 0.14.0 and has now been fully resolved — leagues will load correctly on first launch.

  **Improved:** The Settings → Storage card now shows a clear loading spinner ("Analyzing storage…") while gathering disk usage information, instead of a brief flicker that provided no useful feedback.

  **Improved:** Storage analysis no longer briefly freezes the app window. The file scanning process has been reworked to run smoothly in the background, keeping the interface responsive even with large data folders.

## 0.14.2

### Patch Changes

- [`df96881`](https://github.com/navali-creations/soothsayer/commit/df968819a85b6d2018bd7b3c71a6b5025e02b935) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Resolved an issue where some users were unable to connect to our servers on app startup, causing the league selection to only show "Standard" instead of the full list of available leagues. This was caused by a server-side security key rotation that invalidated previously stored sessions. The app now properly recovers from expired sessions automatically. (REAL, TRUE)

  **Improved:** Added comprehensive crash and error reporting to key parts of the app — including server connections, league fetching, and session management. Previously, many errors were silently handled without being reported, making it difficult to diagnose issues. This will help us identify and fix problems much faster going forward.

## 0.14.1

### Patch Changes

- [`afa46cc`](https://github.com/navali-creations/soothsayer/commit/afa46cc182b1b5515188df49ee697425b12e5967) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** New statistics cards on the Statistics page.

  - **Avg. Profit Per Deck** — Shows how much profit you make per stacked deck on average, displayed in chaos orbs alongside the average deck cost (e.g. `+1.2c / 3.0c`).
  - **Total Time Spent** — The total time you've spent opening stacked decks across all sessions.
  - **Profit Per Hour** — Your average net profit per hour of opening decks — a quick way to see if your time is being well spent.
  - **Win Rate** — The percentage of your sessions that ended in profit, with a breakdown like "7 of 10 sessions profitable."

  **Improved:** Statistics cards are now grouped into themed rows for easier scanning — deck stats on top, profit stats in the middle, and miscellaneous stats on the bottom.

  **Fixed:** Address failing league requests on app startup on fresh installs (surely)

## 0.14.0

### Minor Changes

- [`2082436`](https://github.com/navali-creations/soothsayer/commit/2082436dcbb5f2faf4332c2cde857b0d414f8a6a) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Revamped Statistics page.

  - Redesigned the Statistics page with a new side-by-side layout — interactive chart on the left, card table on the right.
  - Clicking a certain stat cards now takes you directly to that session's detail page.
  - Export CSV button and cards' search input has been moved to card's table, narrowing their purpose.

  **Improved:** Back button navigation.

  - The back button now preserves your navigation history, so pressing it returns you to the page you came from rather than always going to a fixed destination. This applies across session details, card details, and other detail pages.

## 0.13.0

### Minor Changes

- [`df8f2b0`](https://github.com/navali-creations/soothsayer/commit/df8f2b0b693742a780e9f9bb80a67dff9c293e64) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Custom base rate for Profit Forecast.

  - You can now set your own stacked deck exchange rate instead of relying on the market rate. Click the **pencil icon** next to the Base Rate value, type the rate you want (e.g. 90 decks/div), and press Enter.
  - This is useful when you plan to place exchange orders at a fixed price and wait for them to fill — the forecast will calculate costs based on the rate you expect to pay rather than the current market rate.
  - A **custom** badge appears when a custom rate is active. You can reset to the market rate at any time with the **Reset** button.
  - The allowed range is from the break-even rate (minimum) to 110 decks/div (maximum).
  - When selecting 100k or 1M decks, an info banner explains the cost cliff and suggests using a custom rate.

  **Added:** Profit Forecast Breakeven Chart.

  - A new interactive area chart visualises the estimated and optimistic P&L curves across sub-batches, with a break-even reference line.
  - Toggle between **Table** and **Chart** views using the view switcher in the Cost Model panel.

  **Improved:** Profit Forecast UI polish.

  - The "You Spend" and "Estimated Return" descriptions now show cost and value per deck in chaos instead of divine for better readability at a glance.
  - The "Price increase per batch" slider is now disabled when 1k decks is selected, since the rate never drops within a single sub-batch.
  - The "Refresh" button has been removed from the Base Rate stat card to reduce clutter — use the "Refresh poe.ninja" button in the page header instead.
  - The "How It Works" modal and onboarding beacon have been updated to explain the custom rate feature.

  **Improved:** Profit Forecast algorithm now produces more accurate results.

  - The forecast previously used raw Prohibited Library weights to estimate drop probabilities, which systematically underestimated returns for mid-to-high value cards. Two calibration adjustments now correct for this: a probability floor (1 in 50,000) prevents ultra-rare cards from being modelled as virtually impossible, and a 1.25× EV multiplier accounts for the ~25% gap between raw-weight predictions and actual observed returns across thousands of empirical stacked-deck openings. The net effect is that forecasted profit and break-even rates now track real-world outcomes much more closely.

  **Improved:** Rarity Insights scan moved into Filters dropdown.

  - The standalone "Scan" button has been removed from the header and integrated into the Filters dropdown for a cleaner layout.

  **Improved:** Cards without wiki data now show a placeholder instead of disappearing.

  - During league starts, some divination cards may not yet have metadata (artwork, stack size, reward text) on the wiki. Previously these cards would not render at all, hiding them from statistics and the card grid.
  - A placeholder card frame now appears with the card name and a hint that data is not yet available, so you can still see drop statistics, price info, and profit forecast entries for new or unindexed cards.

### Patch Changes

- [`388960c`](https://github.com/navali-creations/soothsayer/commit/388960c572b01efdfe18626a767f6a6f6438b1de) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** New divination cards are now discovered automatically at league start.

  - Previously, cards added in a new league (like "The Slumbering Beast" in Mirage) would not appear anywhere in the app until the bundled card data was updated in a new release. This meant card detail pages returned "not found," and the card was missing from statistics, Profit Forecast, and Rarity Insights.
  - The app now detects new card names from poe.ninja price data and automatically creates placeholder entries so they become searchable and usable immediately — no app update required.
  - Once a full app update ships with complete card metadata (artwork, stack size, reward text), the placeholder is seamlessly replaced with the full card data.

## 0.12.2

### Patch Changes

- [`0e84eca`](https://github.com/navali-creations/soothsayer/commit/0e84ecae86445c22c8c519076cec63f0a8c2292e) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** App crashing on startup with "cannot find module tslib" after updating to 0.12.1.

  - A required library was accidentally excluded from the packaged app, causing a crash on launch. It is now correctly included in the production build.

## 0.12.1

### Patch Changes

- [`735e052`](https://github.com/navali-creations/soothsayer/commit/735e052097fc67048d91adde12fb8b7dcc4e15df) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Search bar on the Statistics page.

  - You can now search and filter your cards directly on the Statistics page.

  **Improved:** The app now recovers automatically from GPU process crashes instead of freezing or closing unexpectedly.

  - Chromium's GPU process can occasionally crash due to driver issues or resource pressure. Previously this could leave the app in a broken state or cause it to close without warning.
  - The app now detects GPU process crashes and automatically relaunches itself. Your session stats are already saved, so no data is lost — you simply pick up where you left off.

- [`a2c8333`](https://github.com/navali-creations/soothsayer/commit/a2c83333c0055606d6ba7ec50cdec4dd8ba2dfc5) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** You can now manually include or exclude any card from Profit Forecast calculations.

  - A new **checkbox column** in the Profit Forecast table lets you toggle whether each card is counted toward EV, break-even rate, and net profit.
  - Cards that are automatically excluded (anomalous or low-confidence prices) can now be **force-included** if you know the price is legitimate — useful at league start when valid prices sometimes get flagged by mistake.
  - Normal cards with suspicious prices (e.g. manipulated listings) can be **manually excluded** so they don't inflate your forecast.
  - Toggling a card immediately recalculates all stat cards (Expected Return, Net Profit, Break-Even Rate) and the P&L columns in the table.
  - Overridden cards are visually distinguished with a blue checkbox and a status icon so you can easily see what you've changed.

## 0.12.0

### Minor Changes

- [`c793409`](https://github.com/navali-creations/soothsayer/commit/c793409014a39d3700f0fbfccb6743163403038e) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Smarter export options on the Statistics page.

  - The old "Export CSV" button has been replaced with a dropdown menu offering two choices:
    - **Export All Cards** — saves everything you've found (same as before).
    - **Export Latest Cards** — saves only the new drops since your last export, with a badge showing how many new cards you have.
  - The dropdown also shows when you last exported, so you always know how up-to-date your files are.

  **Added:** You can now choose where CSV exports are saved.

  - A new **Export** section in **Settings** lets you pick a default folder for CSV files. If you don't set one, exports will save to `Desktop/soothsayer-exports` like before.
  - You can change the folder at any time or reset it back to the default with one click.

  **Added:** Export CSV from individual session pages.

  - Each **Session Details** page now has an **Export CSV** button so you can quickly save the drops from a single session.

### Patch Changes

- [`423f691`](https://github.com/navali-creations/soothsayer/commit/423f69174182e84e33d90ee8237d7d9c3a96104c) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** Discord community link in the app menu and system tray.

  - The "More options" dropdown now includes a **Discord** link so you can join the community server for quick help, feedback, and discussion.
  - The system tray menu has been updated with the same Discord link.
  - GitHub Discussions remains available for longer-form feedback and feature requests — Discord is simply a faster, less intimidating way to get in touch.

- [`eee2294`](https://github.com/navali-creations/soothsayer/commit/eee2294867463e3e096593fc6a08845356f71445) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** App window and overlay no longer appear off-screen after switching monitors.

  - Previously, if you changed your monitor setup (e.g. disconnected a display, rearranged screens, or switched to a different monitor), the app or overlay could open in an invisible position based on the old layout. Now the app checks that its saved position is still within a visible display area on launch — if not, it resets to a default position on your current screen.

- [`423f691`](https://github.com/navali-creations/soothsayer/commit/423f69174182e84e33d90ee8237d7d9c3a96104c) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Toggling card price visibility no longer resets the table to page 1.

  - Previously, hiding or unhiding a card's price in the Current Session or Session Details table would jump you back to the first page. The table now stays on the page you were viewing, so you don't lose your place when toggling multiple cards in a row.

- [`423f691`](https://github.com/navali-creations/soothsayer/commit/423f69174182e84e33d90ee8237d7d9c3a96104c) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Changing the league filter on the Sessions page no longer shows empty results.

  - Previously, switching to a different league while on page 2 or later would show an empty page because the page number wasn't reset. The page now resets to 1 whenever you change the league filter.

## 0.11.0

### Minor Changes

- [`d151bee`](https://github.com/navali-creations/soothsayer/commit/d151beec44835a4d876a9ce0fc9f16156cf30821) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** New **Card Details** page — click any card name in the app to see everything about it in one place.

  - **Card visual** with full rarity glow effects, stack size, reward, and flavour text.
  - **Market Data tab** with live price from poe.ninja (cached locally for 30 minutes), full set value in divine and chaos, 24h/7d/30d price change indicators, and an interactive price history chart with brush/zoom.
  - **Your Data tab** with personal drop statistics — total lifetime drops, first discovered date, last seen, average drops per session, and a cumulative drop timeline chart showing your history across leagues.
  - **Drop statistics** including drop probability, EV contribution per stacked deck, and a "Your Luck" comparison against statistical expectation (based on Prohibited Library weight data).
  - **Related cards** sidebar showing other cards that share the same reward item or are part of the same divination card chain (e.g. The Patient → The Nurse → The Doctor).
  - **Sessions list** for the card with server-side sorting by date, drops, or decks opened.
  - **League selector** in the header to filter all personal data by league.
  - **External links** to PoE Wiki and poe.ninja for quick reference.
  - Card names across the entire app (Cards table, Profit Forecast, Rarity Insights, Session Details, Current Session, Overlay) are now clickable links that navigate to the card's detail page.

### Patch Changes

- [`629b06d`](https://github.com/navali-creations/soothsayer/commit/629b06d1b8c59fa04ec293864232da3a4d7041c4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Card weight data now automatically refreshes after app updates.

  - Previously, updating the app to a new version with fresh card data required a manual reload from Settings. The app now detects version changes and re-reads the bundled data automatically on next launch.

- [`629b06d`](https://github.com/navali-creations/soothsayer/commit/629b06d1b8c59fa04ec293864232da3a4d7041c4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Cards with a weight of zero no longer show incorrect rarity.

  - Cards tracked in the Prohibited Library data with a weight of exactly zero (meaning "unknown/not yet seen") were incorrectly treated as if they weren't in the dataset at all, which could cause them to display the wrong rarity. They are now correctly recognized and shown as "Unknown".

- [`bea26aa`](https://github.com/navali-creations/soothsayer/commit/bea26aa6af4f0936d5d9638e5a66128a7e3ed314) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Simplified the privacy & telemetry step during first-time setup.

  - Removed the toggle switches for crash reporting and usage analytics from the setup wizard — both are now enabled by default for new users.
  - The step now clearly explains what data is collected and names the services used (Sentry for crash reporting, Umami for usage analytics).
  - You can opt out of either at any time in **Settings → Privacy & Telemetry**.

- [`629b06d`](https://github.com/navali-creations/soothsayer/commit/629b06d1b8c59fa04ec293864232da3a4d7041c4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Smarter handling of new league transitions in card weight data.

  - When a new league column is added to the card weight spreadsheet but has no data yet (all zeros), the app now automatically falls back to the most recent league with real data instead of showing all cards as "unknown" rarity.
  - If a new column is added with a temporary patch-version header (e.g. "3.28") instead of a league name, the app gracefully skips it and uses the previous league's data until the column is properly labelled.

- [`629b06d`](https://github.com/navali-creations/soothsayer/commit/629b06d1b8c59fa04ec293864232da3a4d7041c4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Updated:** Prohibited Library card weight data refreshed with latest Keepers league samples.

  - The bundled card weight spreadsheet now includes significantly more data from the Keepers league (sample size increased from ~22k to ~48k decks), improving rarity accuracy across all cards.

## 0.10.0

### Minor Changes

- [`93436da`](https://github.com/navali-creations/soothsayer/commit/93436dade7567def329d7ca092f21116d4b901f8) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Added:** New **Attributions** page.

  - Added a new Attributions page that gives credit to the third-party data sources used in the app: **Prohibited Library**, **poe.ninja**, and **PoE Wiki**.
  - Added an "Attributions" link to the app's more options menu.

- [`4b5ccf3`](https://github.com/navali-creations/soothsayer/commit/4b5ccf3a865b030c2c51bf1c60b0f798cbf44010) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** Profit Forecast now better handles unreliable prices at league start and end.

  - Cards with suspiciously inflated prices (e.g. single-listing artifacts on poe.ninja) are now automatically detected and excluded from EV and break-even calculations, so the forecast no longer looks misleadingly profitable.
  - A new **status column** shows warning icons next to excluded cards, with tooltips explaining why each card was flagged.
  - New **filter checkboxes** above the table let you hide flagged cards from view if you prefer a cleaner list.
  - The minimum exchange rate floor has been lowered from 60 to 20 decks-per-divine, so the cost model no longer clips at an unrealistically high floor during early or late league when rates naturally dip much lower.

- [`8be6490`](https://github.com/navali-creations/soothsayer/commit/8be6490e1b721f60e6a25cffebc9c9fbd961300c) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Renamed:** "Rarity Model" is now called **Rarity Insights**.

  - The sidebar link and page title have been updated to reflect the new name.
  - The navigation icon has been refreshed to better represent the comparison-focused nature of the feature.
  - All functionality remains exactly the same — only the name and appearance have changed.

### Patch Changes

- [`23ccae9`](https://github.com/navali-creations/soothsayer/commit/23ccae9c8ccb4b533470b0a11d6e8ae6b617d0be) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** The Privacy Policy page now loads correctly and displays tables properly.

  - Fixed an issue where the Privacy Policy page would fail to load with a connection error.

- [`0e8bb5a`](https://github.com/navali-creations/soothsayer/commit/0e8bb5a708bbea2a6ea6cfa94415ec4042a286d1) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Fixed:** Crash Reporting and Usage Analytics toggles on the setup page's Privacy & Telemetry step can now be turned off and on as expected.

- [`5b2c8fa`](https://github.com/navali-creations/soothsayer/commit/5b2c8fa95e77b8eb142de604b2f75eb50eaf435a) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  **Improved:** The "core maintainer" label now appears correctly in the What's New popup, matching the Changelog page.

## 0.9.0

### Minor Changes

- [`271bf33`](https://github.com/navali-creations/soothsayer/commit/271bf3365b7bda23250f8302899627c406bb4b62) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  ### Privacy & Telemetry

  You now have full control over what anonymous data Soothsayer sends — and we've added extra protections to keep your information private.

  #### ⚠️ Important for existing users

  **Crash reporting and usage analytics are now off by default.** If you'd like to help us improve Soothsayer, you can turn them on in **Settings → Privacy & Telemetry**.

  #### What's new

  - **Stronger privacy protections** — Any file paths or usernames are automatically removed from crash reports before they ever leave your computer. No personal information is sent, even with crash reporting turned on.
  - **Two separate toggles** — Choose independently whether to share crash reports and usage statistics. Find both in **Settings → Privacy & Telemetry**.
  - **Setup wizard step** — New users will see a Privacy & Telemetry step during first-time setup with clear descriptions of each option.
  - **Privacy Settings card** — A new card on the Settings page lets you change your choices and view the privacy policy at any time.
  - **Privacy Policy** — We've published a full privacy policy explaining what data is collected, how it's used, and your rights.

  #### For new users

  Both options default to **on** during setup. You can turn either off before finishing setup, or change your mind later in Settings.

### Patch Changes

- [`271bf33`](https://github.com/navali-creations/soothsayer/commit/271bf3365b7bda23250f8302899627c406bb4b62) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Changelog page hint:** Added a subtitle explaining that clicking on any card opens the release page on GitHub.
  - **Core maintainer badge:** Contributor badges for core maintainers now show a shield icon and a "core maintainer" label, so you know who's behind each update.

- [`f9fd4b4`](https://github.com/navali-creations/soothsayer/commit/f9fd4b4e2351eafc3f9ccec881b2af5ad976b52b) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Fixed a crash when closing the app during startup:** If you closed Soothsayer before it finished loading (for example, right after installing for the first time), the app could crash with an error. The app now handles this gracefully and shuts down cleanly.

## 0.8.0

### Minor Changes

- [`bfe91e5`](https://github.com/navali-creations/soothsayer/commit/bfe91e5f54fdfb8438678b4386826249fa56a728) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Storage settings card:** A new Storage card on the Settings page shows how much disk space Soothsayer's app data and SQLite database consume. Two progress bars visualise usage — app data relative to total disk space, and the database relative to app data — with human-readable sizes and percentages.

  - **League data cleanup:** The Storage card lists every league with stored data, showing session and snapshot counts alongside estimated sizes. You can delete all data for a league to reclaim space, with a confirmation modal to prevent accidents. The active session's league is protected from deletion.

  - **Low disk space warning:** When free disk space drops below 1 GB a warning icon appears in the app bar. Hovering shows remaining space; clicking navigates straight to Settings so you can clean up.

### Patch Changes

- [`062851b`](https://github.com/navali-creations/soothsayer/commit/062851b9a52a9b17ab1db68eb81ddb54299bf1c4) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Cooldown timer now shows labels:** The countdown timer on the Refresh button now displays "hrs", "min", and "sec" labels beneath the digits, making it easier to read at a glance without affecting the button's size.

- [`601f7f2`](https://github.com/navali-creations/soothsayer/commit/601f7f24f23436ae412d395e1c04f0a9d0f28186) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Masked file paths for privacy:** File paths shown in the Storage card and Game Configuration settings are now masked by default, hiding your OS username. Click the eye icon next to any path to reveal the full location when needed.

  - **Rarity Model now loads Prohibited Library data automatically:** Previously, the Prohibited Library rarity column on the Rarity Model page would appear empty for new users until they visited the Profit Forecast page or manually reloaded from Settings. The bundled card weight data now loads on demand when you open the Rarity Model page.

## 0.7.0

### Minor Changes

- [`9c92a64`](https://github.com/navali-creations/soothsayer/commit/9c92a64e86aebccd555fe3416762bf5753abb99e) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Profit Forecast page:** A new page that projects returns from bulk stacked deck openings. It combines Prohibited Library card weights with poe.ninja snapshot prices to calculate expected value, cost, and profit/loss for any batch size.

  - **Sliding exchange cost model:** Deck prices increase as you buy more — the model simulates this with configurable "price increase per batch" and "batch size" sliders so you can match what you actually see on the exchange.

  - **Batch size presets:** Quickly switch between 1k, 10k, 100k, and 1M deck scenarios to see how returns scale at different volumes.

  - **Summary cards:** At-a-glance stats for EV (expected value) per deck, total cost, total revenue, net P&L, break-even rate, and average cost per deck — all updating live as you adjust the cost model.

  - **Per-card forecast table:** Every card shows its drop probability, expected decks to pull, cost to pull, and two P&L perspectives (card-only and all-drops). Searchable and filterable by minimum price.

  - **Min price filter:** A slider lets you hide low-value cards from the table so you can focus on the ones that matter.

  - **Bulk exchange rate from poe.ninja:** When available, the base rate now uses poe.ninja's `maxVolumeRate` (the actual volume-weighted bulk exchange rate) instead of deriving it from chaos/divine ratio. Older snapshots gracefully fall back to the derived rate.

  - **Help modal:** A detailed explanation of how the forecast model works, accessible from the header.

### Patch Changes

- [`9c92a64`](https://github.com/navali-creations/soothsayer/commit/9c92a64e86aebccd555fe3416762bf5753abb99e) Thanks [@sbsrnt](https://github.com/sbsrnt)!

  - **Overlay tab switching fixed:** The "All" and "Valuable" tabs in the overlay now switch correctly. Previously, clicking either tab would always navigate to the same view instead of toggling between them.

  - **Lazy Prohibited Library loading:** The bundled Prohibited Library CSV is no longer parsed on every app startup. Instead, it loads on first access (e.g. when opening the Profit Forecast or Rarity Model page), resulting in faster startup times.

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
