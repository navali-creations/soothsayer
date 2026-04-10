---
"soothsayer": minor
---

**Added:** Mirage support & Divination card data moved to a dedicated package.

- Card metadata (images, descriptions, stack sizes, rewards) has been moved from bundled app assets into a separate [`@navali/poe1-divination-cards`](https://github.com/navali-creations/fateweaver/tree/main/packages/poe1-divination-cards) package. The card data itself is the same — nothing has changed for the end user — but this separation makes it easier for us to maintain and update card data across releases.
- The app now ships with **Mirage** league card data.

**Added:** Disabled card detection.

- Cards that GGG has drop-disabled (like "The Cheater" in Mirage league) are now tracked automatically. The app knows which cards can no longer drop from stacked decks based on the latest data.
- A new `isDisabled` flag is stored for each card so future UI updates can visually distinguish disabled cards from active ones.

**Improved:** Significant performance improvements across the board.

- Bulk database writes (rarity updates, card syncing, stub card creation) are now wrapped in transactions, making them **10–50× faster** on typical hardware. Previously each card was written individually — now hundreds of writes are batched into a single operation.
- Card syncing at startup is faster: all existing card hashes are fetched in one query instead of one query per card, cutting startup database calls from ~930 down to 1.
- Every card query (browse, search, detail pages) is now faster: an existence check that previously fetched ~450 rows now returns a single boolean, and three sequential data lookups now run in parallel.
- Card image lookups in the renderer are now instant (O(1) Map lookup) instead of scanning all 464 images on every render.
- The path to the card data package is now cached after the first resolution instead of being recalculated on every access.

**Fixed:** Database settings are now fully restored after a database reset. Previously, four out of six performance settings (write synchronisation, cache size, busy timeout, and temp storage) were lost after resetting the database, which could cause slower writes and occasional busy errors. All settings are now consistently applied.
