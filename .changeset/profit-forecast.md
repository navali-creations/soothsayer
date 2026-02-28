---
"soothsayer": minor
---

- **Profit Forecast page:** A new page that projects returns from bulk stacked deck openings. It combines Prohibited Library card weights with poe.ninja snapshot prices to calculate expected value, cost, and profit/loss for any batch size.

- **Sliding exchange cost model:** Deck prices increase as you buy more — the model simulates this with configurable "price increase per batch" and "batch size" sliders so you can match what you actually see on the exchange.

- **Batch size presets:** Quickly switch between 1k, 10k, 100k, and 1M deck scenarios to see how returns scale at different volumes.

- **Summary cards:** At-a-glance stats for EV (expected value) per deck, total cost, total revenue, net P&L, break-even rate, and average cost per deck — all updating live as you adjust the cost model.

- **Per-card forecast table:** Every card shows its drop probability, expected decks to pull, cost to pull, and two P&L perspectives (card-only and all-drops). Searchable and filterable by minimum price.

- **Min price filter:** A slider lets you hide low-value cards from the table so you can focus on the ones that matter.

- **Bulk exchange rate from poe.ninja:** When available, the base rate now uses poe.ninja's `maxVolumeRate` (the actual volume-weighted bulk exchange rate) instead of deriving it from chaos/divine ratio. Older snapshots gracefully fall back to the derived rate.

- **Help modal:** A detailed explanation of how the forecast model works, accessible from the header.