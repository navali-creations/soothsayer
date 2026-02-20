---
"soothsayer": patch
---

- **Overlay now respects your price source setting:** The in-game overlay previously always used exchange prices regardless of your selection. It now correctly shows stash or exchange prices based on your chosen price source.

- **Live price source switching:** Changing your price source mid-session now immediately updates the overlay — no need to restart your session.

- **More accurate card rarities:** Cards that only have stash pricing (no exchange data) are now marked as "Unknown" rarity instead of receiving a potentially misleading rarity based on unreliable stash prices.

- **Unknown rarity indicator:** Cards with low-confidence pricing now show a warning icon in the overlay so you can tell at a glance which prices may be unreliable.

- **Fixed rarity 0 being treated as common:** A bug caused cards intentionally classified as "Unknown" (rarity 0) to silently appear as "Common" (rarity 4). These cards now display correctly.

- **PoE2 default price source:** New installations now default to exchange pricing for PoE2 (previously defaulted to stash). Existing users are not affected.