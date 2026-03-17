---
"soothsayer": patch
---

**Improved:** You can now manually include or exclude any card from Profit Forecast calculations.

- A new **checkbox column** in the Profit Forecast table lets you toggle whether each card is counted toward EV, break-even rate, and net profit.
- Cards that are automatically excluded (anomalous or low-confidence prices) can now be **force-included** if you know the price is legitimate — useful at league start when valid prices sometimes get flagged by mistake.
- Normal cards with suspicious prices (e.g. manipulated listings) can be **manually excluded** so they don't inflate your forecast.
- Toggling a card immediately recalculates all stat cards (Expected Return, Net Profit, Break-Even Rate) and the P&L columns in the table.
- Overridden cards are visually distinguished with a blue checkbox and a status icon so you can easily see what you've changed.