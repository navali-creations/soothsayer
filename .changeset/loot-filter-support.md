---
"soothsayer": minor
---

- **Loot filter support:** Soothsayer can now read your Path of Exile loot filters and use their tier assignments to set card rarities. Both local filters (from your PoE folder) and online filters (e.g. NeverSink) are automatically detected and available to select.

- **Rarity source picker:** A new dropdown on the Cards page, Current Session, and Settings lets you choose how card rarities are determined — either price-based via poe.ninja (the default) or driven by one of your installed loot filters.

- **Filter rarity comparison:** A new "Rarities" tab under Cards lets you compare how different filters classify each divination card side-by-side. You can select multiple filters, search by card name, and even override individual card rarities.

- **Filter settings:** A dedicated settings card lets you manage your rarity source and selected filter without leaving the Settings page. Filters can be rescanned at any time to pick up new or updated files.

- **Price confidence indicators:** Card prices from poe.ninja now include a confidence level (high, medium, or low) so you can tell at a glance how reliable a price estimate is. This information flows through from the backend all the way to the UI.

- **"Unknown" rarity tier:** Cards that haven't been classified yet (e.g. missing from a filter or not yet priced) now show as "unknown" instead of defaulting to "common," giving you a clearer picture of your collection.

- **Overlay improvements:** The overlay drop list now uses the same shared rarity styles as the rest of the app and correctly reflects filter-based rarities when a filter is active.

- **Backend improvements:** Snapshot creation now computes and stores price confidence from poe.ninja data. The card prices table has been updated accordingly, replacing the unused `stack_size` column with a `confidence` column.