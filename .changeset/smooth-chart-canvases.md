---
"soothsayer": patch
---

**Improved:** Chart visuals, interactions and performance across Profit Forecast and card details.

The remaining chart screens now use the app's faster canvas chart system, with cleaner rendering and more consistent controls.

- **Better labels and grid lines** - chart labels, grid lines, hover lines, and filled areas now line up more consistently.
- **More polished tooltips** - tooltips stay closer to the hovered point when they need to flip to the left side.

**Improved:** Card detail charts now have smoother zooming, brushing, and timeline context.

- **Smoother date selection** - timeline brushes can move across the full date range instead of snapping only between days that had drops or price entries.
- **Better zoom behavior** - card detail charts keep a useful minimum number of visible points while zooming, hide the brush when there are too few points for it to help, and support the same scroll-to-zoom behavior as Statistics.
- **Matching brush controls** - card detail brushes now use the same grab cursor, draggable thumbs, grip styling, and outside labels as the Statistics page.
- **Clearer drop timelines** - the drop timeline now compares actual drops against expected drops with layered bars instead of a cumulative line that only ever goes up.
- **Deck volume context** - drop timelines now include a subtle curved line for decks opened, making it easier to see whether high or low drops came from unusually large or small opening days.
- **Compressed quiet periods** - long stretches without drops are visually compressed with subtle gap markers so active sessions are easier to compare.
- **League markers and bounds** - all-league views can show the current league start marker, while single-league views show league start and end bounds when that data is available.
- **Better timeline ranges** - league charts now respect known league windows, and all-league charts start from your first tracked session instead of stretching back to old permanent league dates.
- **Cleaner tooltips and legends** - card detail tooltips now use the same divider, badge, and icon style as Statistics, and legends can be used to hide chart layers.

**Improved:** Statistics charts now share the same chart polish.

- **League start marker** - all-league Statistics charts now show the active league start marker.
- **More consistent tooltip placement** - Statistics tooltips now stay closer to the hovered point when they flip to the left side.
- **Shared chart controls** - common legend icons, brush behavior, scroll zoom, and tooltip positioning are now reused across chart screens for a more consistent feel.
