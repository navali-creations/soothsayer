---
"soothsayer": patch
---

- **Overlay tab switching fixed:** The "All" and "Valuable" tabs in the overlay now switch correctly. Previously, clicking either tab would always navigate to the same view instead of toggling between them.

- **Lazy Prohibited Library loading:** The bundled Prohibited Library CSV is no longer parsed on every app startup. Instead, it loads on first access (e.g. when opening the Profit Forecast or Rarity Model page), resulting in faster startup times.
