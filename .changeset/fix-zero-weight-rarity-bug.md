---
"soothsayer": patch
---

**Fixed:** Cards with a weight of zero no longer show incorrect rarity.

- Cards tracked in the Prohibited Library data with a weight of exactly zero (meaning "unknown/not yet seen") were incorrectly treated as if they weren't in the dataset at all, which could cause them to display the wrong rarity. They are now correctly recognized and shown as "Unknown".