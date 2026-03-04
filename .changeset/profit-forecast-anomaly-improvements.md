---
"soothsayer": minor
---

**Improved:** Profit Forecast now better handles unreliable prices at league start and end.

- Cards with suspiciously inflated prices (e.g. single-listing artifacts on poe.ninja) are now automatically detected and excluded from EV and break-even calculations, so the forecast no longer looks misleadingly profitable.
- A new **status column** shows warning icons next to excluded cards, with tooltips explaining why each card was flagged.
- New **filter checkboxes** above the table let you hide flagged cards from view if you prefer a cleaner list.
- The minimum exchange rate floor has been lowered from 60 to 20 decks-per-divine, so the cost model no longer clips at an unrealistically high floor during early or late league when rates naturally dip much lower.