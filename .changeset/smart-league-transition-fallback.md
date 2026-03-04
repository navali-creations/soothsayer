---
"soothsayer": patch
---

**Improved:** Smarter handling of new league transitions in card weight data.

- When a new league column is added to the card weight spreadsheet but has no data yet (all zeros), the app now automatically falls back to the most recent league with real data instead of showing all cards as "unknown" rarity.
- If a new column is added with a temporary patch-version header (e.g. "3.28") instead of a league name, the app gracefully skips it and uses the previous league's data until the column is properly labelled.