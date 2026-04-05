---
"soothsayer": minor
---

**Added:** Live Session Profit Timeline.

- A new real-time chart now appears on the current session page, showing your cumulative profit over time as you open stacked decks. Every card drop is plotted on a timeline so you can see exactly when big hits landed and how your session's value grew.
- The timeline also appears on past session detail pages, letting you revisit how any previous session played out from start to finish.
- Hovering over the chart shows a tooltip with the card name, its value, and a running total at that point in time.

**Improved:** Major performance overhaul across the entire app.

- The app now feels noticeably snappier during high-volume deck openings. A full audit of the card-drop pipeline — from file detection through database writes, IPC messaging, and on-screen rendering — identified and resolved over a dozen bottlenecks.
- Database operations are faster: settings are now cached in memory instead of queried on every drop, duplicate-checking is instant instead of scanning a growing list, and session totals update in a single step instead of recounting every card.
- Drawing performance is smoother: canvas charts no longer redraw dozens of times per second during window resizing, gradient colours are cached instead of recalculated every frame, and only the parts of the interface that actually changed will re-render — previously almost every visible component would re-render on each card drop.
- Memory usage is more predictable with capped internal history and optimised data structures throughout.

**Removed:** The "Most Common Card" stat from the session details page.

- This card almost always showed Rain of Chaos (since it's by far the most frequently dropped divination card), making it unhelpful. The space has been reclaimed for more useful information.