---
"soothsayer": minor
---

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

**Improved:** Rarity Insights scan moved into Filters dropdown.

- The standalone "Scan" button has been removed from the header and integrated into the Filters dropdown for a cleaner layout.

**Improved:** Cards without wiki data now show a placeholder instead of disappearing.

- During league starts, some divination cards may not yet have metadata (artwork, stack size, reward text) on the wiki. Previously these cards would not render at all, hiding them from statistics and the card grid.
- A placeholder card frame now appears with the card name and a hint that data is not yet available, so you can still see drop statistics, price info, and profit forecast entries for new or unindexed cards.
