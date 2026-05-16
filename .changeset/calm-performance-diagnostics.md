---
"soothsayer": minor
---

**Added:** App Performance diagnostics.

- A new opt-in **App Performance** page helps you capture what Soothsayer is doing while the app is running.
- Diagnostics can record FPS, CPU, and memory over time, with route markers so you can see which page or workflow was active when a spike happened.
- Captures can be reviewed later, compared in the history view, deleted when no longer needed, and exported as a support report that can be attached to Discord or an issue.
- The sidebar now shows compact live FPS, CPU, and RAM charts while diagnostics are running.

**Improved:** Settings are easier to scan and manage.

- Settings have been reorganized into clearer sections with more consistent cards, controls, and spacing.

**Improved:** Charts and tables are more readable.

- App Performance charts now show recent activity more clearly by default, preserve long captures, and connect unavailable data gaps with dashed line segments instead of silently leaving empty spaces.
- Chart tooltips now stay inside the chart area and avoid covering the cursor as much as possible.
- Route markers are easier to read on expanded charts and hidden from compact charts where they would create clutter.
- The shared table component has been split into smaller pieces, keeping table headers, rows, sorting, and pagination more consistent across the app.
