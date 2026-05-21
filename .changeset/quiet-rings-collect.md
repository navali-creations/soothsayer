---
"soothsayer": minor
---

**Removed:** Soothsayer no longer uses the poe.ninja stash API as a secondary and fallback price source.

poe.ninja has removed divination card stash pricing, and it is not coming back, so Soothsayer has been updated accordingly across its features.

- **Current Session, Settings & Session Details**: the exchange/stash tab selector has been removed.
- **Sessions & Session Details**: stash value has been removed, and `exchange` is now `value`.
- **Rarity**: Soothsayer app versions below 0.18.0 now show stash price confidence as `unknown` wherever the stash API was present.
- **Current Session**: the price source beacon has been removed.
